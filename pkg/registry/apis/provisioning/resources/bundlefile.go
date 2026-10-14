package resources

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"sort"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// bundleFileNameHashLen is how much of the path hash goes into a bundle file's name.
// 12 hex characters is 48 bits, which is ample for the at-most-128 paths one bundle may
// claim while keeping the name readable.
const bundleFileNameHashLen = 12

// bundleFileNamePrefixMax bounds the bundle portion of a generated name so that the
// result stays inside the 253-character limit for a resource name.
const bundleFileNamePrefixMax = 200

// BundleFileName derives the stable name of the BundleFile holding path for a bundle.
//
// The name covers (bundle, path) and deliberately not the ref: when a bundle advances,
// each of its files is updated in place or deleted, and a name cannot be updated.
func BundleFileName(bundle, path string) string {
	sum := sha256.Sum256([]byte(path))
	suffix := hex.EncodeToString(sum[:])[:bundleFileNameHashLen]

	prefix := bundle
	if len(prefix) > bundleFileNamePrefixMax {
		prefix = prefix[:bundleFileNamePrefixMax]
	}
	return prefix + "-" + suffix
}

// BundleFileOptions describes one file to be stored for a bundle.
type BundleFileOptions struct {
	Namespace  string
	Repository string
	// Bundle is the name of the resource claiming this file.
	Bundle string
	// Path is repository-root-relative.
	Path string
	// Ref is the repository ref this content was read at.
	Ref string
	// Data is the raw file content; it is base64-encoded into the object.
	Data []byte
}

// NewBundleFile builds the BundleFile for one supporting file.
//
// Content is always base64-encoded, whatever the file holds: bundles carry arbitrary
// files, and one representation avoids both guessing at text and mangling anything that
// is not valid UTF-8. Hash and Size describe the decoded content, so they can be compared
// against a freshly read file without decoding the stored one.
func NewBundleFile(opts BundleFileOptions) *provisioning.BundleFile {
	sum := sha256.Sum256(opts.Data)

	return &provisioning.BundleFile{
		ObjectMeta: metav1.ObjectMeta{
			Name:      BundleFileName(opts.Bundle, opts.Path),
			Namespace: opts.Namespace,
			Labels: map[string]string{
				provisioning.BundleFileRepositoryLabel: opts.Repository,
				provisioning.BundleFileBundleLabel:     opts.Bundle,
			},
		},
		Spec: provisioning.BundleFileSpec{
			Repository: opts.Repository,
			Bundle:     opts.Bundle,
			Path:       opts.Path,
			Ref:        opts.Ref,
			Hash:       "sha256:" + hex.EncodeToString(sum[:]),
			Size:       int64(len(opts.Data)),
			Content:    base64.StdEncoding.EncodeToString(opts.Data),
		},
	}
}

// BundleFileAction is what reconciliation has to do to one bundle file.
type BundleFileAction string

const (
	// BundleFileActionCreate stores a file the bundle did not have.
	BundleFileActionCreate BundleFileAction = "create"
	// BundleFileActionUpdate replaces a file whose content changed.
	BundleFileActionUpdate BundleFileAction = "update"
	// BundleFileActionRefresh advances a file to a newer ref without changing its
	// content. Separate from update so a caller can see how much of a reconcile is
	// content and how much is only the ref moving.
	BundleFileActionRefresh BundleFileAction = "refresh"
	// BundleFileActionDelete removes a file the bundle no longer claims.
	BundleFileActionDelete BundleFileAction = "delete"
	// BundleFileActionUnchanged is a file already at the target ref with the same
	// content. It is reported so a caller can account for the whole set, and carries no
	// write.
	BundleFileActionUnchanged BundleFileAction = "unchanged"
)

// BundleFileChange is one file's part of a reconcile.
type BundleFileChange struct {
	Action BundleFileAction
	// Name of the BundleFile resource.
	Name string
	// Path in the repository.
	Path string
	// File is the object to write. Nil for delete and unchanged.
	File *provisioning.BundleFile
}

// BundleFileChanges is the full reconcile for one bundle's file set at a ref.
type BundleFileChanges struct {
	// Ref the desired set was read at.
	Ref string
	// Changes in path order.
	Changes []BundleFileChange
}

// Writes returns the changes that have to be applied before the bundle may publish the
// ref, in path order.
func (c BundleFileChanges) Writes() []BundleFileChange {
	out := make([]BundleFileChange, 0, len(c.Changes))
	for _, change := range c.Changes {
		switch change.Action {
		case BundleFileActionCreate, BundleFileActionUpdate, BundleFileActionRefresh, BundleFileActionDelete:
			out = append(out, change)
		case BundleFileActionUnchanged:
		}
	}
	return out
}

// Count returns how many changes carry the given action.
func (c BundleFileChanges) Count(action BundleFileAction) int {
	var n int
	for _, change := range c.Changes {
		if change.Action == action {
			n++
		}
	}
	return n
}

// IsEmpty reports whether the reconcile has nothing to write.
func (c BundleFileChanges) IsEmpty() bool { return len(c.Writes()) == 0 }

// DiffBundleFiles works out what has to change for a bundle to hold exactly desired at
// its ref, given the files it currently holds.
//
// Deletions are emitted for files the bundle no longer claims, so a path dropped from a
// selector -- or one that stopped matching a pattern -- does not linger. Nothing is
// delete-then-created: a file that persists is updated in place, because deleting it
// first would be a visible gap for anything reading concurrently.
//
// Files already at the target ref with unchanged content are reported as unchanged
// rather than omitted, so a caller can tell "nothing to do" from "nothing found".
func DiffBundleFiles(existing, desired []*provisioning.BundleFile, ref string) BundleFileChanges {
	changes := BundleFileChanges{Ref: ref}

	current := make(map[string]*provisioning.BundleFile, len(existing))
	for _, file := range existing {
		if file == nil {
			continue
		}
		current[file.Name] = file
	}

	seen := make(map[string]struct{}, len(desired))
	for _, want := range desired {
		if want == nil {
			continue
		}
		seen[want.Name] = struct{}{}

		have, found := current[want.Name]
		switch {
		case !found:
			changes.Changes = append(changes.Changes, BundleFileChange{
				Action: BundleFileActionCreate,
				Name:   want.Name,
				Path:   want.Spec.Path,
				File:   want,
			})
		case have.Spec.Hash != want.Spec.Hash:
			changes.Changes = append(changes.Changes, BundleFileChange{
				Action: BundleFileActionUpdate,
				Name:   want.Name,
				Path:   want.Spec.Path,
				File:   want,
			})
		case have.Spec.Ref != want.Spec.Ref:
			// Content is identical, so only the ref moves. The file still has to be
			// written: a stale ref cannot be told from a current one by a reader, and
			// every file carrying its own ref is what lets a consumer check it against
			// the bundle's published ref.
			changes.Changes = append(changes.Changes, BundleFileChange{
				Action: BundleFileActionRefresh,
				Name:   want.Name,
				Path:   want.Spec.Path,
				File:   want,
			})
		default:
			changes.Changes = append(changes.Changes, BundleFileChange{
				Action: BundleFileActionUnchanged,
				Name:   want.Name,
				Path:   want.Spec.Path,
			})
		}
	}

	for _, file := range existing {
		if file == nil {
			continue
		}
		if _, keep := seen[file.Name]; keep {
			continue
		}
		changes.Changes = append(changes.Changes, BundleFileChange{
			Action: BundleFileActionDelete,
			Name:   file.Name,
			Path:   file.Spec.Path,
		})
	}

	sort.Slice(changes.Changes, func(i, j int) bool {
		if changes.Changes[i].Path != changes.Changes[j].Path {
			return changes.Changes[i].Path < changes.Changes[j].Path
		}
		return changes.Changes[i].Name < changes.Changes[j].Name
	})

	return changes
}

// BundleFilesPublishable reports whether every file in the set is stored at ref.
//
// This is the barrier a bundle publishes behind: its ref is advanced only once all of its
// supporting files are present at that ref, so a consumer reading the published ref is
// guaranteed the whole set. A partial failure leaves the bundle on its previous ref with
// its previous, consistent set.
func BundleFilesPublishable(files []*provisioning.BundleFile, ref string) bool {
	for _, file := range files {
		if file == nil || file.Spec.Ref != ref {
			return false
		}
	}
	return true
}

// DecodeBundleFile returns the file's content.
func DecodeBundleFile(file *provisioning.BundleFile) ([]byte, error) {
	if file == nil {
		return nil, nil
	}
	data, err := base64.StdEncoding.DecodeString(file.Spec.Content)
	if err != nil {
		return nil, fmt.Errorf("decode bundle file %q: %w", file.Spec.Path, err)
	}
	return data, nil
}
