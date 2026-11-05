package resources

import (
	"errors"
	"fmt"
	"sort"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/util/sets"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
)

const (
	// BundleMaxEntries caps how many paths a bundle may declare. Separate from
	// BundleMaxFiles: one folder entry expands to many files.
	BundleMaxEntries = 64
	// BundleMaxFiles caps how many files a bundle may resolve to. The cap is what keeps
	// the resolved set small enough to list in the bundle's status, which is where a
	// consumer reads it from.
	BundleMaxFiles = 128
)

// bundlePathsField is where a Bundle declares its paths. Bundle is a provisioning kind,
// so this is an ordinary spec field. The entries are paths rather than files because one
// of them may be a folder; what they resolve to is reported in status.files.
var bundlePathsField = []string{"spec", "paths"}

var (
	// ErrBundlePathsType reports a spec.paths value that is not a list of strings.
	ErrBundlePathsType = errors.New("spec.paths must be a list of paths")
	// ErrBundleTooManyEntries reports a bundle declaring more than BundleMaxEntries paths.
	ErrBundleTooManyEntries = fmt.Errorf("a bundle may declare at most %d paths", BundleMaxEntries)
	// ErrBundleTooManyFiles reports a resolution exceeding BundleMaxFiles.
	ErrBundleTooManyFiles = fmt.Errorf("a bundle may resolve to at most %d files", BundleMaxFiles)
	// ErrBundleEntryEmpty reports an empty entry in spec.paths.
	ErrBundleEntryEmpty = errors.New("a bundle path must not be empty")
	// ErrBundleEntryDuplicate reports the same path listed twice by one bundle.
	ErrBundleEntryDuplicate = errors.New("duplicate bundle path")
)

// BundleEntryError reports an invalid entry in a bundle's spec.paths, naming the offending
// path so the caller can surface which entry failed without re-deriving it.
type BundleEntryError struct {
	// Path is the declared entry, exactly as it appeared in spec.paths.
	Path string
	Err  error
}

func (e *BundleEntryError) Error() string {
	return fmt.Sprintf("bundle path %q is not valid: %v", e.Path, e.Err)
}

func (e *BundleEntryError) Unwrap() error { return e.Err }

// BundleEntry is one declared path in a bundle's file set: either a single file or, with
// a trailing separator, a folder whose contents belong to the bundle.
type BundleEntry struct {
	// Path is repository-root-relative. A trailing "/" marks a folder, the same
	// convention the rest of provisioning uses (see safepath.IsDir).
	Path string
}

// IsFolder reports whether the entry selects a folder's contents rather than one file.
func (e BundleEntry) IsFolder() bool { return safepath.IsDir(e.Path) }

// matches reports whether path is selected by this entry. A folder entry selects
// everything beneath it, at any depth.
func (e BundleEntry) matches(path string) bool {
	if !e.IsFolder() {
		return path == e.Path
	}
	return strings.HasPrefix(path, e.Path)
}

// ParseBundleEntries reads and validates the paths a bundle declares in spec.paths.
//
// Paths are repository-root-relative, matching every other path in provisioning, so a
// bundle may claim files that do not sit beside its own manifest. They are validated
// against the same path rules as any other repository path, but deliberately not against
// the resource extensions: carrying files the resource pipeline cannot parse is the point
// of a bundle.
//
// Selection is by path only -- a file, or a folder and everything under it. There are no
// patterns: a repository path is already the addressing scheme provisioning uses
// everywhere else, and a declared path is both readable in a diff and cheap to check.
//
// A bundle with no spec.paths is valid and returns no entries.
func ParseBundleEntries(obj *unstructured.Unstructured) ([]BundleEntry, error) {
	if obj == nil {
		return nil, nil
	}

	raw, found, err := unstructured.NestedFieldNoCopy(obj.Object, bundlePathsField...)
	if err != nil {
		return nil, ErrBundlePathsType
	}
	if !found || raw == nil {
		return nil, nil
	}

	values, ok := raw.([]any)
	if !ok {
		return nil, ErrBundlePathsType
	}
	paths := make([]string, 0, len(values))
	for _, value := range values {
		raw, ok := value.(string)
		if !ok {
			return nil, ErrBundlePathsType
		}
		paths = append(paths, raw)
	}

	return BundleEntriesFromPaths(paths)
}

// BundleEntriesFromPaths validates declared paths and turns them into entries.
//
// Split out from ParseBundleEntries so admission can apply exactly the same rules to a
// typed Bundle written straight to the API as the parser applies to one read from a
// repository. The two must not drift: a path rejected on one route and accepted on the
// other is a bundle whose contents depend on how it arrived.
func BundleEntriesFromPaths(paths []string) ([]BundleEntry, error) {
	if len(paths) > BundleMaxEntries {
		return nil, ErrBundleTooManyEntries
	}

	entries := make([]BundleEntry, 0, len(paths))
	seen := sets.New[string]()
	for _, raw := range paths {
		path := strings.TrimSpace(raw)
		if path == "" || path == "/" {
			return nil, &BundleEntryError{Path: raw, Err: ErrBundleEntryEmpty}
		}
		// validatePathBasics works on the path proper, so check a folder entry without
		// its trailing separator.
		if err := validatePathBasics(strings.TrimSuffix(path, "/")); err != nil {
			return nil, &BundleEntryError{Path: raw, Err: err}
		}
		if seen.Has(path) {
			return nil, &BundleEntryError{Path: raw, Err: ErrBundleEntryDuplicate}
		}

		seen.Insert(path)
		entries = append(entries, BundleEntry{Path: path})
	}

	return entries, nil
}

// BundleResolution is a bundle's file set as resolved against one repository ref.
//
// It is what the bundle reports in its status, and the ref it was resolved at is part of
// it: without that, a resolved list is a claim with no referent, and neither staleness
// nor safe deletion can be determined.
type BundleResolution struct {
	// Ref is the repository ref (commit) the entries were resolved against.
	Ref string
	// Files is every resolved path, de-duplicated and sorted.
	Files []string
	// Unresolved names the declared paths that matched nothing. Reported rather than
	// hidden: a folder that was renamed away must surface, not silently empty the bundle.
	Unresolved []string
}

// IsComplete reports whether every declared path resolved to at least one file.
func (r BundleResolution) IsComplete() bool { return len(r.Unresolved) == 0 }

// ResolveOptions carries what resolution needs beyond the entries themselves.
type ResolveOptions struct {
	// Ref is the repository ref the candidate paths were listed at; recorded on the
	// resolution.
	Ref string
	// ManifestPath is the bundle's own file, which it never claims.
	ManifestPath string
	// Reserved are paths no bundle may claim -- other manifests, chiefly, so a folder
	// entry cannot swallow another resource and give the same bytes two lifecycles.
	Reserved sets.Set[string]
}

// ResolveBundleFiles expands a bundle's declared paths against the repository paths listed
// at a ref.
//
// A file entry resolves to itself when present; a folder entry resolves to everything
// beneath it. Candidates that are not valid repository paths are skipped rather than
// rejected: the listing describes a repository as it is, and a bundle cannot be held
// responsible for an unrelated file elsewhere in it.
func ResolveBundleFiles(entries []BundleEntry, candidates []string, opts ResolveOptions) (BundleResolution, error) {
	resolution := BundleResolution{Ref: opts.Ref}
	if len(entries) == 0 {
		return resolution, nil
	}

	eligible := make([]string, 0, len(candidates))
	for _, path := range candidates {
		if path == opts.ManifestPath || opts.Reserved.Has(path) {
			continue
		}
		if safepath.IsDir(path) || validatePathBasics(path) != nil {
			continue
		}
		eligible = append(eligible, path)
	}
	sort.Strings(eligible)

	claimed := sets.New[string]()
	for _, entry := range entries {
		var matched int
		for _, path := range eligible {
			if claimed.Has(path) || !entry.matches(path) {
				continue
			}
			claimed.Insert(path)
			resolution.Files = append(resolution.Files, path)
			matched++
		}

		if matched == 0 {
			resolution.Unresolved = append(resolution.Unresolved, entry.Path)
		}
	}

	if len(resolution.Files) > BundleMaxFiles {
		return BundleResolution{Ref: opts.Ref}, ErrBundleTooManyFiles
	}
	sort.Strings(resolution.Files)

	return resolution, nil
}

// BundleIndex records which bundle claims which repository path.
//
// Its one job is to answer whether a path belongs to a bundle, so the rest of the
// pipeline does not also treat it as a standalone resource or an unmanaged raw file --
// that would give the same bytes two lifecycles.
//
// Files are not shared: each bundle holds its own copy of what it claims, so two bundles
// declaring the same path is not a conflict and each simply stores it. Deletion is per
// bundle; there is nothing to reference-count.
//
// A BundleIndex is built per operation (a sync pass, a request) and is not safe for
// concurrent writes.
type BundleIndex struct {
	// claims maps a repository path to the bundles claiming it.
	claims map[string]sets.Set[string]
	// files maps a bundle's manifest path to the paths it claims.
	files map[string][]string
}

// NewBundleIndex returns an empty index.
func NewBundleIndex() *BundleIndex {
	return &BundleIndex{
		claims: make(map[string]sets.Set[string]),
		files:  make(map[string][]string),
	}
}

// Add records the files claimed by the bundle at manifestPath, replacing any claim it
// previously held.
func (i *BundleIndex) Add(manifestPath string, files []string) {
	i.Remove(manifestPath)

	for _, path := range files {
		bundles, ok := i.claims[path]
		if !ok {
			bundles = sets.New[string]()
			i.claims[path] = bundles
		}
		bundles.Insert(manifestPath)
	}
	i.files[manifestPath] = files
}

// AddResolution records a resolved bundle's files.
func (i *BundleIndex) AddResolution(manifestPath string, resolution BundleResolution) {
	i.Add(manifestPath, resolution.Files)
}

// Remove drops a bundle and releases the paths it claimed.
func (i *BundleIndex) Remove(manifestPath string) {
	for _, path := range i.files[manifestPath] {
		bundles, ok := i.claims[path]
		if !ok {
			continue
		}
		bundles.Delete(manifestPath)
		if bundles.Len() == 0 {
			delete(i.claims, path)
		}
	}
	delete(i.files, manifestPath)
}

// Claimants returns the manifest paths of every bundle claiming path, sorted. More than
// one is possible: each keeps its own copy.
func (i *BundleIndex) Claimants(path string) []string {
	return sets.List(i.claims[path])
}

// IsClaimed reports whether any bundle claims path.
func (i *BundleIndex) IsClaimed(path string) bool {
	return i.claims[path].Len() > 0
}

// Files returns the paths claimed by the bundle at manifestPath.
func (i *BundleIndex) Files(manifestPath string) []string {
	return i.files[manifestPath]
}

// Paths returns every claimed path across all bundles, sorted.
func (i *BundleIndex) Paths() []string {
	out := make([]string, 0, len(i.claims))
	for path := range i.claims {
		out = append(out, path)
	}
	sort.Strings(out)
	return out
}

// Bundles returns the manifest paths of every indexed bundle, sorted.
func (i *BundleIndex) Bundles() []string {
	out := make([]string, 0, len(i.files))
	for manifestPath := range i.files {
		out = append(out, manifestPath)
	}
	sort.Strings(out)
	return out
}

// BundleKind is the kind of the provisioning resource that groups repository files.
const BundleKind = "Bundle"

// A resource names the Bundle it uses with the provisioning.BundleLabel label.
//
// A label rather than a spec field so that no consuming kind owes a schema change: a
// strictly validated kind would otherwise have its manifest rejected while decoding for
// an undeclared field, which is the whole problem the separate Bundle resource exists to
// avoid. Provisioning already attaches its own metadata to kinds it does not own --
// managedBy, managerId, sourcePath -- and this is the same kind of thing.
//
// A label rather than an annotation because the reference is used for selection: it is
// what answers "what uses this bundle" without reading the spec of every resource of
// every linkable kind.

// ErrBundleRefTooLong reports a bundle name that cannot be carried as a label value.
// Caught here so the error names the bundle reference rather than surfacing later as a
// generic label validation failure from the apiserver.
var ErrBundleRefTooLong = fmt.Errorf("a referenced bundle name must be at most %d characters", bundleRefMaxLen)

// bundleRefMaxLen bounds a referenced bundle's name: it is carried as a label value, and
// those may not exceed 63 characters. Resource names may be longer, so the limit has to
// be stated rather than assumed.
const bundleRefMaxLen = 63

// ParseBundleRef reads the name of the Bundle a resource references. An empty result
// means the resource uses no bundle, which is always valid.
func ParseBundleRef(obj *unstructured.Unstructured) (string, error) {
	if obj == nil {
		return "", nil
	}

	name := strings.TrimSpace(obj.GetLabels()[provisioning.BundleLabel])
	if len(name) > bundleRefMaxLen {
		return "", ErrBundleRefTooLong
	}
	return name, nil
}
