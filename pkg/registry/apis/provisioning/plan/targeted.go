package plan

import (
	"fmt"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/converge"
)

// Write describes one interactive mutation: what the files API was asked to do.
type Write struct {
	// Path is the destination. Hash is the content being written, empty for a
	// delete.
	Path string
	Hash string

	// From is set for a move or rename.
	From string

	// Delete asks for removal rather than a write.
	Delete bool

	// Folder marks the path as a directory rather than a file.
	Folder bool
}

// Targeted builds the plan for one interactive mutation.
//
// A single write is a plan of one or two operations, and planning it as a plan
// is what gives the interactive path the same authorisation pass as a
// convergence run: the folders the write materialises are in the plan, with
// the provenance of each identity, so a permission check sees the inherited
// permissions that actually govern it.
//
// Nearby is what the target holds at and around the path — the key itself, its
// ancestors, and for a move the origin. It is read by the caller; nothing here
// performs I/O.
func Targeted(repoName string, w Write, nearby *provisioning.ResourceList) (*converge.Plan, error) {
	if w.Path == "" {
		return nil, fmt.Errorf("write has no path")
	}

	hints := []converge.Key{converge.Key(w.Path)}
	if w.Folder {
		hints[0] = hints[0].AsContainer()
	}
	if w.From != "" {
		from := converge.Key(w.From)
		if w.Folder {
			from = from.AsContainer()
		}
		hints = append(hints, from)
	}

	var desired []converge.Declaration
	if !w.Delete {
		// Classification is shared with the convergence path: a key sync would
		// refuse must be refused here too, with the same reason, or the API
		// accepts writes the next sync deletes.
		// The same classifier either way: a directory the sync would refuse
		// must be refused here too, or the API accepts a folder the next sync
		// deletes.
		d := declareFile(repository.FileTreeEntry{Path: w.Path, Hash: w.Hash, Blob: true})
		if w.Folder {
			d = declareDirectory(converge.Key(w.Path).AsContainer())
			// The content the caller is writing about the folder. Classifying
			// the path must not throw away what is being written, or a metadata
			// write plans nothing — or an update to an empty fingerprint.
			d.Fingerprint = converge.Fingerprint(w.Hash)
		}
		desired = append(desired, d)
	}

	// Ancestors of the destination are declared so the plan materialises the
	// path a write needs. A delete needs no path: declaring them would plan
	// folder creation, and ask for permission to create it, in order to remove
	// something that is not there.
	if !w.Delete {
		for _, a := range converge.Key(w.Path).Ancestors() {
			desired = append(desired, converge.Declaration{Key: a, Container: true})
		}
	}

	observed, _ := Observe(nearby) // a targeted write makes no claim about rows it cannot address
	return converge.NewPlan(desired, observed,
		converge.WithContainers(FolderConfig(repoName)),
		converge.WithHints(converge.HintSet{Keys: hints, Complete: true}),
		converge.WithExclusionScope(converge.ScopeTargeted),
	)
}

// Rejected reports the reason the plan refuses to write at the given path, if
// it does. A files API returns this as a 4xx rather than attempting the write.
func Rejected(p *converge.Plan, path string) (converge.Reason, bool) {
	key := converge.Key(path)
	for _, e := range p.Exclusions {
		if e.Key == key || e.Key == key.AsContainer() {
			return e.Reason, true
		}
	}
	for _, e := range p.Rejected {
		if e.Key == key {
			return e.Reason, true
		}
	}
	return "", false
}

// FolderPathOf returns the repository path of the folder an operation lands
// in, for callers that still address folders by path rather than identity.
func FolderPathOf(op converge.Op) string {
	if op.Container == "" {
		return ""
	}
	return safepath.EnsureTrailingSlash(string(op.Container))
}
