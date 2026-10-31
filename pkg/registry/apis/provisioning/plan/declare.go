package plan

import (
	"strings"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/converge"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// Reasons attached to entities the repository declares but Grafana will not
// hold. Each one is permanent given the content at a ref: fixing it means
// changing the repository, not retrying.
const (
	ReasonUnsupportedPath converge.Reason = "provisioning/unsupported-path"
	ReasonInvalidFolder   converge.Reason = "provisioning/invalid-folder-metadata"
)

// FolderConfig describes how Grafana materialises folders from a repository
// tree: implied by the paths beneath them, identified by a hash of the path
// and repository name unless a _folder.json pins a UID.
func FolderConfig(repoName string) converge.ContainerConfig {
	return converge.ContainerConfig{
		Implied: true,
		// No MaxDepth: the depth limit is already part of path support, so a
		// folder too deep can only be implied by a file that was excluded for
		// the same reason. Enforcing it twice would turn a reported exclusion
		// into a failed plan.
		FallbackIdentity: func(k converge.Key) converge.Identity {
			return converge.Identity(resources.ParseFolder(string(k), repoName).ID)
		},
		// Changing a folder's _folder.json changes the folder, so an
		// incremental run pointed at the metadata file must re-examine the
		// folder it describes.
		ContainerFor: func(k converge.Key) (converge.Key, bool) {
			if !resources.IsFolderMetadataFile(string(k)) {
				return "", false
			}
			return converge.Key(safepath.EnsureTrailingSlash(safepath.Dir(string(k)))), true
		},
		// Grafana addresses a dashboard by its parent folder's UID, so
		// re-parenting one level is enough.
		ReparentDescendants: false,
	}
}

// FolderMetadata is a _folder.json that has already been read and parsed. The
// planner performs no I/O, so a caller resolves these before declaring.
type FolderMetadata struct {
	UID   string
	Valid bool

	// Held is the identity Grafana currently has for the folder, if any. It is
	// what an unusable claim falls back to.
	//
	// Leaving the declaration's identity empty is not the same as preserving
	// one: the planner then derives the path-based identity, which *replaces*
	// a pinned UID and re-parents every child. Naming the held identity is how
	// "drop the claim, keep the folder" stays true to itself.
	Held string
}

// Declare converts a repository tree into what the repository declares.
//
// The classification is the one decision this package exists to make, and it
// is the same decision on every path:
//
//   - a directory, or a _folder.json, declares a folder;
//   - a file at a supported path declares a resource;
//   - a file that looks like a resource but sits at a path Grafana cannot
//     address declares a resource that cannot be held, so it is reported;
//   - anything else — a README, an image, a .keep, a hidden file — was never a
//     resource and stays invisible.
//
// The line between the last two is the whole user-visible difference between a
// dashboard that disappears with a warning and one that disappears silently.
func Declare(tree []repository.FileTreeEntry, metadata map[string]FolderMetadata) []converge.Declaration {
	out := make([]converge.Declaration, 0, len(tree))

	for _, entry := range tree {
		switch {
		case !entry.Blob:
			dir := converge.Key(safepath.EnsureTrailingSlash(entry.Path))
			if dir == "" {
				continue // the repository root is not a folder sync owns
			}
			out = append(out, declareDirectory(dir))

		case resources.IsFolderMetadataFile(entry.Path):
			dir := converge.Key(safepath.EnsureTrailingSlash(safepath.Dir(entry.Path)))
			if dir == "" {
				continue
			}
			d := converge.Declaration{Key: dir, Container: true, Fingerprint: converge.Fingerprint(entry.Hash)}
			if unsupported := resources.IsPathSupported(string(dir)); unsupported != nil {
				d.Verdict, d.Reason = converge.Excluded, ReasonUnsupportedPath
				out = append(out, d)
				continue
			}
			// An unparseable _folder.json makes the identity claim unusable,
			// not the folder. The folder is still declared at this key; it
			// keeps the identity it already has, or takes the derived one if
			// it is new. Excluding it instead would delete a folder, and
			// everything in it, over one bad line in a metadata file.
			if md, ok := metadata[string(dir)]; ok {
				switch {
				case md.Valid:
					d.Identity = converge.Identity(md.UID)
				case md.Held != "":
					d.Identity = converge.Identity(md.Held)
				}
			}
			out = append(out, d)

		default:
			out = append(out, declareFile(entry))
		}
	}

	return out
}

// declareDirectory classifies a directory. A folder at a path Grafana cannot
// address is no more a folder than a file at one is a resource: excluding it is
// what keeps the safe part of the path — and only the safe part — from being
// created, and pulls everything underneath out with it.
func declareDirectory(dir converge.Key) converge.Declaration {
	d := converge.Declaration{Key: dir.AsContainer(), Container: true}
	if err := resources.IsPathSupported(string(d.Key)); err != nil {
		d.Verdict, d.Reason = converge.Excluded, ReasonUnsupportedPath
	}
	return d
}

// fileEntry adapts a bare path for classification, for callers that have a
// path and no tree entry.
func fileEntry(path string) repository.FileTreeEntry {
	return repository.FileTreeEntry{Path: path, Blob: true}
}

func declareFile(entry repository.FileTreeEntry) converge.Declaration {
	d := converge.Declaration{
		Key:         converge.Key(entry.Path),
		Fingerprint: converge.Fingerprint(entry.Hash),
	}
	if resources.IsPathSupported(entry.Path) == nil {
		return d
	}
	if safepath.IsHidden(entry.Path) || !resources.HasResourceExtension(entry.Path) {
		d.Verdict = converge.Ignored
		return d
	}
	d.Verdict, d.Reason = converge.Excluded, ReasonUnsupportedPath
	return d
}

// observedIdentity names what the target holds.
//
// A resource name is not unique: a dashboard and a playlist can share both a
// path and a name, and identical identities make identical operation
// references — after which one deletion is applied twice and the other object
// is left managed. Non-folder identities therefore carry their kind.
//
// Folder identities stay raw, because they are what a resource's parent is
// compared against and what the actuator removes a folder by.
func observedIdentity(item *provisioning.ResourceListItem, isFolder bool) converge.Identity {
	if isFolder {
		return converge.Identity(item.Name)
	}
	return converge.Identity(item.Group + "/" + item.Resource + "/" + item.Name)
}

// ResourceName recovers the target's own name from an identity produced by
// [Observe].
func ResourceName(id converge.Identity) string {
	s := string(id)
	if i := strings.LastIndex(s, "/"); i >= 0 {
		return s[i+1:]
	}
	return s
}

// Unaddressable reports a resource the target holds that has no source path,
// so no repository content can describe it and no diff can reach it.
type Unaddressable struct {
	Group    string
	Resource string
	Name     string
}

// Observe converts Grafana's view of what a repository manages into what the
// target holds, and reports the rows no diff can address.
//
// A non-folder row with no path is an anomaly on the target's side: nothing in
// the repository describes it, and no repository edit can reach it. Leaving it
// alone and naming it is the only option the contract allows — failing the run
// would let one such row block every other resource in the repository
// indefinitely, and the user could not clear it by changing the repository,
// which is the trade-off Proposal 3 was rejected for.
func Observe(list *provisioning.ResourceList) ([]converge.Observation, []Unaddressable) {
	if list == nil {
		return nil, nil
	}
	var unaddressable []Unaddressable
	out := make([]converge.Observation, 0, len(list.Items))
	for i := range list.Items {
		item := &list.Items[i]
		if item.Path == "" {
			// The repository's own root folder legitimately has no path.
			if item.Resource != resources.FolderResource.Resource {
				unaddressable = append(unaddressable, Unaddressable{
					Group: item.Group, Resource: item.Resource, Name: item.Name,
				})
			}
			continue
		}
		isFolder := item.Resource == resources.FolderResource.Resource
		key := converge.Key(item.Path)
		if isFolder {
			key = converge.Key(safepath.EnsureTrailingSlash(item.Path))
		}
		out = append(out, converge.Observation{
			Key:         key,
			Identity:    observedIdentity(item, isFolder),
			Fingerprint: converge.Fingerprint(item.Hash),
			Container:   isFolder,
			// Which folder the resource is actually in. Without it a resource
			// under one of two folders sharing a path looks settled, and the
			// folder it belongs to cannot be emptied.
			Parent: converge.Identity(item.Folder),
		})
	}
	return out, unaddressable
}

// Hints converts a commit diff into a planning window.
//
// The diff says where to look and nothing more: whether a rename happened is
// re-derived from content, so a diff that reports one carries no authority. A
// caller with no previous ref, or one that cannot be reached, must leave
// Complete false and get a full run.
//
// Ancestor folders and the folder a _folder.json describes are added by the
// planner's own hint closure, via [FolderConfig]'s ContainerFor — stating that
// here as well would be the same rule in two places, drifting apart.
func Hints(changes []repository.VersionedFileChange, complete bool) converge.HintSet {
	keys := make([]converge.Key, 0, len(changes)*2)
	for _, c := range changes {
		if c.Path != "" {
			keys = append(keys, converge.Key(c.Path))
		}
		if c.PreviousPath != "" {
			keys = append(keys, converge.Key(c.PreviousPath))
		}
	}
	return converge.HintSet{Keys: keys, Complete: complete}
}
