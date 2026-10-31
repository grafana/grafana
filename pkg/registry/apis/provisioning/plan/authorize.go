package plan

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/converge"
)

// Permission is the single question an authorizer answers under a plan.
//
// Today the same question is asked through six specialised methods —
// authorize-resource, authorize-create-folder, authorize-delete-by-path,
// authorize-move-by-path and so on — each of which re-reads the file and
// re-resolves the folder in order to work out what it is being asked about.
// A plan has already worked that out.
type Permission struct {
	// Verb is create, update or delete.
	Verb string

	// Folder is the identity of the folder the check runs against. It is
	// always one the target holds, never one the request asserted: see
	// [Vetoes].
	Folder string

	// Path and IsFolder describe what is being acted on.
	Path     string
	IsFolder bool
}

// Checker answers one permission question. An error means denied; a nil error
// means allowed. A transient failure must be returned as [TransientError] so
// it is not mistaken for a denial.
type Checker interface {
	Check(ctx context.Context, p Permission) error
}

// FolderResolver resolves a folder identity from trusted state — in
// provisioning's case, by reading the configured branch rather than the ref
// the request named.
type FolderResolver func(ctx context.Context, folderPath string) (string, error)

// TransientError marks a failure that says nothing about permission: a
// timeout, a 5xx, contention. It aborts the run rather than becoming a veto,
// because converting one into a denial reports "not permitted" to a user whose
// permissions are fine, and silently preserves a resource nothing declares.
type TransientError struct{ Err error }

func (e *TransientError) Error() string { return "transient: " + e.Err.Error() }
func (e *TransientError) Unwrap() error { return e.Err }

// Vetoes authorises a whole plan and returns the operations that may not run.
//
// # Why background jobs do not use this yet
//
// The move and delete workers classify their paths through
// [RefuseUnsupportedPaths] but do not authorise through here, and adding it
// would be worse than leaving it out.
//
// A job's worker runs under a provisioning service identity —
// identity.WithProvisioningIdentity in the job driver — not the identity of
// whoever asked for the job. A veto pass over that context would check the
// service account's permissions, which pass everything: an authorisation step
// that authorises nothing, but which every later reader would take as proof the
// path is covered.
//
// Making it real means re-establishing the requesting identity inside the
// worker from the job's author annotations, which is impersonation driven by an
// annotation and needs to be designed and reviewed as such, not inferred from
// the fact that the annotation happens to be there.
//
// One pass serves the convergence path and the interactive path, which is the
// point: two implementations of one rule produce an API that accepts a write
// the next sync deletes.
//
// The provenance check is not new policy. It is the existing rule — folder
// metadata is read from the configured branch, never from a caller-supplied
// ref, because branch metadata is user-controlled and a branch can claim any
// folder UID it likes — relocated out of one implementation into something
// both paths see.
func Vetoes(ctx context.Context, p *converge.Plan, c Checker, resolve FolderResolver) ([]converge.Veto, error) {
	var out []converge.Veto

	for _, op := range p.Ops {
		verb, ok := verbFor(op)
		if !ok {
			continue
		}

		// A container removal names the parent key but carries no identity for
		// it, and the zero provenance reads as trusted, so an unresolved parent
		// would be checked as the root — deleting a nested folder would ask for
		// permission in a folder it is not in. Resolve whenever the identity is
		// missing for a container that has one.
		folder := string(op.ContainerIdentity)
		if !op.ContainerProvenance.Trusted() || (folder == "" && op.Container != "") {
			resolved, err := resolve(ctx, FolderPathOf(op))
			if err != nil {
				return nil, fmt.Errorf("resolve folder for %s: %w", op.Key, err)
			}
			folder = resolved
		}

		err := c.Check(ctx, Permission{
			Verb:     verb,
			Folder:   folder,
			Path:     string(op.Key),
			IsFolder: op.Kind.IsContainerOp() || op.Key.IsContainer(),
		})
		if err == nil {
			continue
		}
		var transient *TransientError
		if errors.As(err, &transient) {
			return nil, transient
		}
		out = append(out, converge.Veto{Ref: op.Ref(), Reason: converge.Reason(err.Error())})
	}

	return out, nil
}

// verbFor derives the permission a caller needs. The kind alone is not enough:
// an ensure brings a container into existence *and* re-asserts an existing
// one's content or parent, and asking for create permission on an update can
// refuse a change the caller is allowed to make.
func verbFor(op converge.Op) (string, bool) {
	switch op.Kind {
	case converge.OpEnsureContainer:
		switch op.Reason {
		case converge.ReasonContentChanged, converge.ReasonParentChanged, converge.ReasonReparent:
			return "update", true
		default:
			return "create", true
		}
	case converge.OpCreate:
		return "create", true
	case converge.OpUpdate:
		return "update", true
	case converge.OpMove:
		return "update", true
	case converge.OpDelete, converge.OpRemoveContainer:
		return "delete", true
	}
	return "", false
}
