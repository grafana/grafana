package plan

import (
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/converge"
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
	var out []PathRefusal
	for _, path := range paths {
		if path == "" {
			continue
		}
		var d converge.Declaration
		if safepath.IsDir(path) {
			d = declareDirectory(converge.Key(path))
		} else {
			d = declareFile(fileEntry(path))
		}
		if d.Verdict != converge.Excluded {
			continue
		}
		out = append(out, PathRefusal{Path: path, Reason: d.Reason})
	}
	return out
}
