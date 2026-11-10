package source

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"path"
	"slices"
	"strings"
	"sync/atomic"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	sourcev1 "github.com/grafana/grafana/apps/provisioning/pkg/source/v1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

const (
	maxPathSegments = 8
	maxPathLength   = 1024
)

var (
	_ repository.ReaderWriter      = (*sourceRepository)(nil)
	_ repository.SizeLimitedReader = (*sourceRepository)(nil)
	_ repository.Versioned         = (*versionedSourceRepository)(nil)
)

// sourceRepository is a read-only repository backed by a Source API endpoint.
type sourceRepository struct {
	config  *provisioning.Repository
	client  *Client
	desc    *sourcev1.Descriptor
	metrics *repository.OperationRecorder
	// webhookSecret authenticates change hints; empty means hints are off.
	webhookSecret common.RawSecureValue

	maxBytes atomic.Int64
}

// versionedSourceRepository is returned when the source advertises revisions.
// Whether a repository is Versioned is decided by type assertion in the controller,
// so a source without revisions must not expose the methods at all.
type versionedSourceRepository struct {
	*sourceRepository
}

// NewRepository builds the repository for a source, picking the shape from its capabilities.
func NewRepository(config *provisioning.Repository, client *Client, desc *sourcev1.Descriptor, metrics *repository.OperationMetrics, webhookSecret common.RawSecureValue) repository.Repository {
	r := &sourceRepository{
		config:        config,
		client:        client,
		desc:          desc,
		metrics:       metrics.Recorder(config.Spec.Type),
		webhookSecret: webhookSecret,
	}
	if desc.GetCapabilities().GetRevision() {
		return &versionedSourceRepository{r}
	}
	return r
}

func (r *sourceRepository) Config() *provisioning.Repository {
	return r.config
}

func (r *sourceRepository) WithMaxFileSize(maxBytes int64) {
	r.maxBytes.Store(maxBytes)
}

// Test refreshes the descriptor, which proves the URL, the credentials and the contract version.
func (r *sourceRepository) Test(ctx context.Context) (*provisioning.TestResults, error) {
	_, err := r.client.Descriptor(ctx, true)
	switch {
	case err == nil:
		return &provisioning.TestResults{Code: http.StatusOK, Success: true}, nil
	case errors.Is(err, repository.ErrUnauthorized), errors.Is(err, repository.ErrPermissionDenied):
		code := http.StatusUnauthorized
		if errors.Is(err, repository.ErrPermissionDenied) {
			code = http.StatusForbidden
		}
		return testFailure(code, field.NewPath("secure", "token"), err), nil
	case errors.Is(err, ErrSourceNotFound):
		return testFailure(http.StatusBadRequest, field.NewPath("spec", "source", "url"), err), nil
	default:
		return nil, err
	}
}

func testFailure(code int, f *field.Path, err error) *provisioning.TestResults {
	return &provisioning.TestResults{
		Code:    code,
		Success: false,
		Errors: []provisioning.ErrorDetails{{
			Type:   metav1.CauseTypeFieldValueInvalid,
			Field:  f.String(),
			Detail: err.Error(),
		}},
	}
}

func (r *sourceRepository) Read(ctx context.Context, filePath, ref string) (out *repository.FileInfo, err error) {
	start := time.Now()
	defer func() { r.metrics.Read(start, out, err) }()

	if err := validateRef(ref); err != nil {
		return nil, err
	}

	// Directories are implicit in a source; there is nothing to fetch.
	if safepath.IsDir(filePath) {
		return &repository.FileInfo{Path: filePath, Ref: ref}, nil
	}

	maxBytes := r.maxBytes.Load()
	if maxBytes <= 0 {
		maxBytes = int64(r.desc.GetLimits().GetMaxFileBytes())
	}

	data, hash, err := r.client.File(ctx, filePath, ref, maxBytes)
	if err != nil {
		return nil, err
	}
	return &repository.FileInfo{Path: filePath, Data: data, Ref: ref, Hash: hash}, nil
}

func (r *sourceRepository) ReadTree(ctx context.Context, ref string) (_ []repository.FileTreeEntry, err error) {
	start := time.Now()
	defer func() { r.metrics.List(start, err) }()

	if err := validateRef(ref); err != nil {
		return nil, err
	}

	_, entries, err := r.client.Tree(ctx, ref, r.desc.GetLimits())
	if err != nil {
		return nil, err
	}

	tree, err := treeEntries(entries)
	if err != nil {
		return nil, err
	}
	if len(tree) == 0 && r.refusesEmptyTree() {
		return nil, ErrEmptyTree
	}
	return tree, nil
}

// refusesEmptyTree reports whether an empty tree must fail the sync: the repository manages
// resources, so syncing it would delete them, and the policy does not say that is intended.
func (r *sourceRepository) refusesEmptyTree() bool {
	if src := r.config.Spec.Source; src != nil && src.EmptyTreePolicy == provisioning.SourceEmptyTreeAllow {
		return false
	}
	for _, c := range r.config.Status.Stats {
		if c.Count > 0 {
			return true
		}
	}
	return false
}

// refuseEmptyPrune applies the same guard to a change list, which prunes without ever reading the tree.
func (r *sourceRepository) refuseEmptyPrune(ctx context.Context, changes []repository.VersionedFileChange, head string) error {
	if !r.refusesEmptyTree() || !slices.ContainsFunc(changes, func(c repository.VersionedFileChange) bool {
		return c.Action == repository.FileActionDeleted
	}) {
		return nil
	}

	empty, err := r.client.TreeEmpty(ctx, head)
	if err != nil {
		return err
	}
	if empty {
		return ErrEmptyTree
	}
	return nil
}

// treeEntries converts wire entries and synthesizes the directory entries sync expects.
func treeEntries(entries []*sourcev1.TreeEntry) ([]repository.FileTreeEntry, error) {
	out := make([]repository.FileTreeEntry, 0, len(entries))
	dirs := map[string]struct{}{}

	for _, e := range entries {
		ok, err := visible(e.GetPath())
		if err != nil {
			return nil, err
		}
		if !ok {
			continue
		}

		out = append(out, repository.FileTreeEntry{Path: e.GetPath(), Hash: e.GetHash(), Size: int64(e.GetSize()), Blob: true})
		for dir := path.Dir(e.GetPath()); dir != "."; dir = path.Dir(dir) {
			dirs[dir+"/"] = struct{}{}
		}
	}

	for dir := range dirs {
		out = append(out, repository.FileTreeEntry{Path: dir})
	}
	slices.SortFunc(out, func(a, b repository.FileTreeEntry) int { return strings.Compare(a.Path, b.Path) })
	return out, nil
}

// The sync worker only accepts a ReaderWriter, so the Writer half exists but refuses.
// Admission already rejects write workflows, which keeps the UI from offering edits.
var errReadOnly = apierrors.NewBadRequest("source repositories are read-only")

func (r *sourceRepository) Create(context.Context, string, string, []byte, string) error {
	return errReadOnly
}

func (r *sourceRepository) Update(context.Context, string, string, []byte, string) error {
	return errReadOnly
}

func (r *sourceRepository) Write(context.Context, string, string, []byte, string) error {
	return errReadOnly
}

func (r *sourceRepository) Delete(context.Context, string, string, string) error {
	return errReadOnly
}

func (r *sourceRepository) Move(context.Context, string, string, string, string) error {
	return errReadOnly
}

func (r *versionedSourceRepository) LatestRef(ctx context.Context) (string, error) {
	return r.client.Revision(ctx)
}

// CompareFiles asks the source when it can, and diffs two trees when it only keeps history.
// Anything else is an error, which the controller answers with a full sync.
func (r *versionedSourceRepository) CompareFiles(ctx context.Context, base, ref string) (_ []repository.VersionedFileChange, err error) {
	start := time.Now()
	defer func() { r.metrics.Compare(start, err) }()

	if base == "" || ref == "" {
		return nil, fmt.Errorf("base and ref cannot be empty")
	}
	for _, rev := range []string{base, ref} {
		if err := validateRef(rev); err != nil {
			return nil, err
		}
	}

	var changes []*sourcev1.Change
	switch {
	case r.desc.GetCapabilities().GetCompare():
		changes, err = r.client.Compare(ctx, base, ref)
	case r.desc.GetCapabilities().GetHistory() != nil:
		changes, err = r.diffTrees(ctx, base, ref)
	default:
		err = ErrNotSupported
	}
	if err != nil {
		return nil, err
	}
	out, err := versionedChanges(changes, base, ref)
	if err != nil {
		return nil, err
	}
	if err := r.refuseEmptyPrune(ctx, out, ref); err != nil {
		return nil, err
	}
	return out, nil
}

// diffTrees turns two snapshots into the change list a compare would have returned.
func (r *versionedSourceRepository) diffTrees(ctx context.Context, base, head string) ([]*sourcev1.Change, error) {
	_, before, err := r.client.Tree(ctx, base, r.desc.GetLimits())
	if err != nil {
		return nil, fmt.Errorf("read tree at %s: %w", base, err)
	}
	_, after, err := r.client.Tree(ctx, head, r.desc.GetLimits())
	if err != nil {
		return nil, fmt.Errorf("read tree at %s: %w", head, err)
	}

	old := make(map[string]string, len(before))
	for _, e := range before {
		old[e.GetPath()] = e.GetHash()
	}

	var changes []*sourcev1.Change
	for _, e := range after {
		hash, existed := old[e.GetPath()]
		switch {
		case !existed:
			changes = append(changes, &sourcev1.Change{Action: sourcev1.ActionCreated, Path: e.GetPath()})
		case hash != e.GetHash():
			changes = append(changes, &sourcev1.Change{Action: sourcev1.ActionUpdated, Path: e.GetPath()})
		}
		delete(old, e.GetPath())
	}
	for p := range old {
		changes = append(changes, &sourcev1.Change{Action: sourcev1.ActionDeleted, Path: p})
	}
	slices.SortFunc(changes, func(a, b *sourcev1.Change) int { return strings.Compare(a.GetPath(), b.GetPath()) })
	return changes, nil
}

// versionedChanges applies the hidden-path policy of ReadTree to a change list.
// A rename across the boundary of the visible tree becomes a create or a delete.
func versionedChanges(changes []*sourcev1.Change, base, head string) ([]repository.VersionedFileChange, error) {
	out := make([]repository.VersionedFileChange, 0, len(changes))
	for _, c := range changes {
		isVisible, err := visible(c.GetPath())
		if err != nil {
			return nil, err
		}

		switch c.GetAction() {
		case sourcev1.ActionCreated:
			if isVisible {
				out = append(out, repository.VersionedFileChange{Action: repository.FileActionCreated, Path: c.GetPath(), Ref: head})
			}
		case sourcev1.ActionUpdated:
			if isVisible {
				out = append(out, repository.VersionedFileChange{Action: repository.FileActionUpdated, Path: c.GetPath(), Ref: head, PreviousRef: base})
			}
		case sourcev1.ActionDeleted:
			if isVisible {
				out = append(out, repository.VersionedFileChange{
					Action: repository.FileActionDeleted, Path: c.GetPath(), PreviousPath: c.GetPath(), Ref: head, PreviousRef: base,
				})
			}
		case sourcev1.ActionRenamed:
			wasVisible, err := visible(c.GetPreviousPath())
			if err != nil {
				return nil, err
			}
			switch {
			case isVisible && wasVisible:
				out = append(out, repository.VersionedFileChange{
					Action: repository.FileActionRenamed, Path: c.GetPath(), PreviousPath: c.GetPreviousPath(), Ref: head, PreviousRef: base,
				})
			case isVisible:
				out = append(out, repository.VersionedFileChange{Action: repository.FileActionCreated, Path: c.GetPath(), Ref: head})
			case wasVisible:
				out = append(out, repository.VersionedFileChange{
					Action: repository.FileActionDeleted, Path: c.GetPreviousPath(), PreviousPath: c.GetPreviousPath(), Ref: head, PreviousRef: base,
				})
			}
		default:
			return nil, fmt.Errorf("source returned an unknown change action %q", c.GetAction())
		}
	}
	return out, nil
}

// History is not part of the contract: sources keep revisions for diffing, not for browsing.
func (r *versionedSourceRepository) History(context.Context, string, string) ([]provisioning.HistoryItem, error) {
	return nil, notBrowsable("history")
}

func (r *versionedSourceRepository) ListRefs(context.Context) ([]provisioning.RefItem, error) {
	return nil, notBrowsable("refs")
}

func notBrowsable(what string) error {
	return apierrors.NewMethodNotSupported(schema.GroupResource{Group: provisioning.GROUP, Resource: "repositories"}, what)
}

// validateRef accepts an empty ref (the current revision) or a well-formed revision.
func validateRef(ref string) error {
	if ref != "" && !revisionPattern.MatchString(ref) {
		return repository.ErrInvalidRef
	}
	return nil
}

// visible reports whether a path belongs to the synced tree. Hidden paths are dropped,
// as every repository does; a malformed path is an error, since it means the source is broken.
func visible(p string) (bool, error) {
	if repository.IsIgnoredPath(p, false) {
		return false, nil
	}
	if err := validatePath(p); err != nil {
		return false, fmt.Errorf("source returned an invalid path %q: %w", p, err)
	}
	return true, nil
}

// validatePath enforces the wire format: relative, bounded, and only manifest files.
func validatePath(p string) error {
	switch {
	case p == "" || len(p) > maxPathLength:
		return errors.New("empty or too long")
	case strings.HasPrefix(p, "/") || strings.HasSuffix(p, "/"):
		return errors.New("must be relative and name a file")
	case len(strings.Split(p, "/")) > maxPathSegments:
		return fmt.Errorf("more than %d segments", maxPathSegments)
	}

	// A .keep marker is allowed; the directory it sits in is what gets checked.
	checked, base := p, path.Base(p)
	if base == ".keep" {
		checked = path.Dir(p)
	} else if ext := path.Ext(base); ext != ".yaml" && ext != ".yml" && ext != ".json" {
		return errors.New("extension must be .yaml, .yml or .json")
	}
	if checked == "." {
		return nil
	}
	return safepath.IsSafe(checked)
}
