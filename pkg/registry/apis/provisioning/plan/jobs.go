package plan

import (
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/converge"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// PathRefusal is a path a job was asked to write that Grafana cannot address.
type PathRefusal struct {
	Path   string
	Reason converge.Reason
}

// RefuseUnsupportedPaths classifies the paths a move or delete job would write
// and returns the ones Grafana cannot hold.
//
// A move job constructs its target path by joining a directory with a base
// name and writes it without ever classifying it, so a move can land a resource
// at a path the next sync will delete — the repository and Grafana disagree,
// and nothing says why. The classifier that decides this for the sync and the
// files API decides it here too, which is the whole point of there being one.
//
// Authorisation is a separate question and is deliberately not answered here;
// see [Vetoes] and the note in the move worker.
func RefuseUnsupportedPaths(paths ...string) []PathRefusal {
	return refusePaths(paths)
}

// RefuseUnsupportedMove classifies a move's destination and, for a directory,
// every destination its contents would land at.
//
// Checking only the destination folder is not enough: a directory move is a
// tree move, so pushing a folder one level deeper takes everything inside it
// one level deeper too, and a resource can pass the depth limit at the old
// place and fail at the new one. Git moves the tree without classifying any of
// it, so the move succeeds and the next sync removes what became unaddressable.
//
// sourcePaths are the repository paths currently under sourceDir; the caller
// supplies them because reading the tree is I/O.
func RefuseUnsupportedMove(sourceDir, targetDir string, sourcePaths []string) []PathRefusal {
	paths := []string{targetDir}
	for _, p := range sourcePaths {
		rel, err := safepath.RelativeTo(p, sourceDir)
		if err != nil || rel == "" {
			continue // the source directory itself is already classified as targetDir
		}
		paths = append(paths, safepath.Join(targetDir, rel))
	}
	return refusePaths(paths)
}

func refusePaths(paths []string) []PathRefusal {
	var out []PathRefusal
	seen := make(map[string]bool, len(paths))
	for _, path := range paths {
		if path == "" {
			continue
		}
		d, key := declarePath(path)
		if d.Verdict != converge.Excluded || seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, PathRefusal{Path: key, Reason: d.Reason})
	}
	return out
}

// declarePath classifies a single repository path the way [Declare] classifies
// a tree entry, and reports the path the verdict is about.
//
// A _folder.json declares the directory holding it, not a resource at its own
// path. Classifying it as a file refuses a folder sitting at the maximum depth,
// because the metadata file inside it is one level deeper than the folder it
// describes — so a move that sync would accept gets refused.
func declarePath(path string) (converge.Declaration, string) {
	switch {
	case safepath.IsDir(path):
		return declareDirectory(converge.Key(path)), path
	case resources.IsFolderMetadataFile(path):
		dir := safepath.EnsureTrailingSlash(safepath.Dir(path))
		if dir == "" {
			return converge.Declaration{}, path // metadata for the root, which sync does not own
		}
		return declareDirectory(converge.Key(dir)), dir
	default:
		return declareFile(fileEntry(path)), path
	}
}
