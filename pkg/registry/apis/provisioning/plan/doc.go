// Package plan adapts provisioning's repositories and resources onto the
// converge planner.
//
// It is the whole of the domain knowledge: what a key means, which keys are
// entities, which are folders, and where a folder's identity comes from.
// Everything downstream of it — the diff, the ordering, the re-parenting, the
// orphan cleanup — is generic and lives in
// [github.com/grafana/grafana/pkg/converge].
//
// Both the convergence path (sync jobs) and the interactive path (the files
// API) build their plans here, which is the point: a key the sync would refuse
// must be refused by the write path too, with the same reason, or the API
// accepts writes that the next sync deletes.
package plan
