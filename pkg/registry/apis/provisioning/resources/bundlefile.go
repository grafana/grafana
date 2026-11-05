package resources

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"sort"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// bundleFileNameHashLen is how much of the path hash goes into a bundle file's name.
// 12 hex characters is 48 bits, which is ample for the at-most-128 files one bundle may
// hold while keeping the name readable.
const bundleFileNameHashLen = 12

// bundleFileNamePrefixMax bounds the bundle portion of a generated name so that the
// result stays inside the 253-character limit for a resource name.
const bundleFileNamePrefixMax = 200

// BundleFileName derives the stable name of the BundleFile holding path for a bundle.
//
// The name covers (bundle, path): a file belongs to one bundle and two bundles declaring
// the same repository path each store their own copy. It deliberately does not cover a
// ref -- a name cannot be updated, and the content is versioned by its hash.
func BundleFileName(bundle, path string) string {
	sum := sha256.Sum256([]byte(path))
	suffix := hex.EncodeToString(sum[:])[:bundleFileNameHashLen]

	prefix := bundle
	if len(prefix) > bundleFileNamePrefixMax {
		prefix = prefix[:bundleFileNamePrefixMax]
	}
	return prefix + "-" + suffix
}

// BundleFolderID derives the UID of the folder a bundle's files are placed in.
//
// Files are foldered under their bundle so a folder view shows a bundle as a folder of its
// files, rather than scattering them beside unrelated resources.
//
// The UID is derived the same way every other provisioning folder UID is -- hashed and
// salted by repository, so it is deterministic and a valid Kubernetes name. The hash key
// is prefixed so a bundle can never land on the UID of a repository directory that merely
// shares its name: ParseFolder keys on the directory path, this keys on "bundle/<name>".
func BundleFolderID(bundle, repository string) string {
	return appendHashSuffix("bundle/"+bundle, repository)(sanitiseKubeName(bundle))
}

// BundleFileOptions describes one file to be stored for a bundle.
type BundleFileOptions struct {
	Namespace  string
	Repository string
	// Bundle is the name of the Bundle this file belongs to.
	Bundle string
	// Path is repository-root-relative.
	Path string
	// Data is the raw file content; it is base64-encoded into the object.
	Data []byte
}

// NewBundleFile builds the BundleFile for one supporting file.
//
// Content is always base64-encoded, whatever the file holds: bundles carry arbitrary
// files, and one representation avoids both guessing at text and mangling anything that
// is not valid UTF-8. Hash and Size describe the decoded content, so they can be compared
// against a freshly read file without decoding the stored one -- the hash is also the
// version a bundle records, so there is nothing else to keep in step.
//
// The file is placed in the bundle's folder, so a folder view groups a bundle's files
// under it. The folder itself is the reconciler's to create; this only stamps the
// annotation that puts the file in it.
func NewBundleFile(opts BundleFileOptions) *provisioning.BundleFile {
	sum := sha256.Sum256(opts.Data)

	file := &provisioning.BundleFile{
		ObjectMeta: metav1.ObjectMeta{
			Name:      BundleFileName(opts.Bundle, opts.Path),
			Namespace: opts.Namespace,
			Labels: map[string]string{
				provisioning.BundleFileRepositoryLabel: opts.Repository,
				provisioning.BundleLabel:               opts.Bundle,
			},
		},
		Spec: provisioning.BundleFileSpec{
			Repository: opts.Repository,
			Bundle:     opts.Bundle,
			Path:       opts.Path,
			Hash:       "sha256:" + hex.EncodeToString(sum[:]),
			Size:       int64(len(opts.Data)),
			Content:    base64.StdEncoding.EncodeToString(opts.Data),
		},
	}

	// MetaAccessor only fails for an object without ObjectMeta, which BundleFile has.
	if meta, err := utils.MetaAccessor(file); err == nil {
		meta.SetFolder(BundleFolderID(opts.Bundle, opts.Repository))
	}

	return file
}

// BundleFileAction is what reconciliation has to do to one bundle file.
type BundleFileAction string

const (
	// BundleFileActionCreate stores a file the bundle did not have.
	BundleFileActionCreate BundleFileAction = "create"
	// BundleFileActionUpdate replaces a file whose content changed.
	BundleFileActionUpdate BundleFileAction = "update"
	// BundleFileActionDelete removes a file the bundle no longer holds.
	BundleFileActionDelete BundleFileAction = "delete"
	// BundleFileActionUnchanged is a stored file whose content already matches. It is
	// reported so a caller can account for the whole set, and carries no write.
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

// BundleFileChanges is the full reconcile for one bundle's stored files.
type BundleFileChanges struct {
	// Changes in path order.
	Changes []BundleFileChange
}

// Writes returns the changes that have to be applied, in path order.
func (c BundleFileChanges) Writes() []BundleFileChange {
	out := make([]BundleFileChange, 0, len(c.Changes))
	for _, change := range c.Changes {
		switch change.Action {
		case BundleFileActionCreate, BundleFileActionUpdate, BundleFileActionDelete:
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

// DiffBundleFiles works out what has to change for a bundle to hold exactly desired,
// given the files it currently stores.
//
// A file belongs to one bundle, so this is a per-bundle reconcile: a path the bundle no
// longer resolves to is deleted, whatever other bundles do with the same repository path.
//
// Nothing is delete-then-created: a file that persists is updated in place, because
// deleting it first would be a visible gap for anything reading concurrently. A stored
// file whose content already matches is reported as unchanged rather than omitted, so a
// caller can tell "nothing to do" from "nothing found" -- and because the hash is the
// only version marker, an unchanged file costs no write at all when bundles advance.
func DiffBundleFiles(existing, desired []*provisioning.BundleFile) BundleFileChanges {
	var changes BundleFileChanges

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

// BundleFileRefs projects the files a bundle holds into the index it publishes in status.
//
// Taking the built BundleFiles rather than bare paths is what lets the index carry each
// file's name, hash and size: a consumer then fetches content directly by name, with no
// listing and no reimplementation of the name derivation.
func BundleFileRefs(files []*provisioning.BundleFile) []provisioning.BundleFileRef {
	refs := make([]provisioning.BundleFileRef, 0, len(files))
	for _, file := range files {
		if file == nil {
			continue
		}
		refs = append(refs, provisioning.BundleFileRef{
			Path: file.Spec.Path,
			Name: file.Name,
			Hash: file.Spec.Hash,
			Size: file.Spec.Size,
		})
	}
	sort.Slice(refs, func(i, j int) bool { return refs[i].Path < refs[j].Path })
	return refs
}

// BundleFilesPublishable reports whether every file a bundle resolved is stored with the
// hash the bundle resolved for it.
//
// This is the barrier a bundle publishes behind: its status ref is advanced only once all
// of its files are stored at the content it resolved, so a consumer reading the published
// ref is guaranteed the whole set. A partial failure leaves the bundle on its previous
// ref with its previous, consistent set.
//
// Comparing hashes rather than a ref is what lets a file carry no ref of its own: the
// stored content either is what the bundle resolved or it is not.
func BundleFilesPublishable(stored []*provisioning.BundleFile, expected []provisioning.BundleFileRef) bool {
	byName := make(map[string]string, len(stored))
	for _, file := range stored {
		if file == nil {
			continue
		}
		byName[file.Name] = file.Spec.Hash
	}

	for _, want := range expected {
		if byName[want.Name] != want.Hash {
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
