package plan

import (
	"context"
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
		verb, ok := verbFor(op.Kind)
		if !ok {
			continue
		}

		folder := string(op.ContainerIdentity)
		if !op.ContainerProvenance.Trusted() {
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
		if transient, is := err.(*TransientError); is {
			return nil, transient
		}
		out = append(out, converge.Veto{Ref: op.Ref(), Reason: converge.Reason(err.Error())})
	}

	return out, nil
}

func verbFor(k converge.OpKind) (string, bool) {
	switch k {
	case converge.OpCreate, converge.OpEnsureContainer:
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
