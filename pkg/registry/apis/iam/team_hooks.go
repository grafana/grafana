package iam

import (
	"context"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic/registry"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	v1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

// noopFinishUpdate is returned by BeginTeamUpdate when there is nothing to
// sync. See BeginTeamUpdate for why a nil FinishFunc would panic.
var noopFinishUpdate registry.FinishFunc = func(_ context.Context, _ bool) {}

// teamMembersByName indexes spec.members by subject UID. The diff in
// BeginTeamUpdate keys on subject only — Permission is not part of the key
// because a member can only have one permission per team, so a permission
// change is detected as an update rather than as a remove+add.
func teamMembersByName(members []iamv0.TeamTeamMember) map[string]iamv0.TeamTeamMember {
	out := make(map[string]iamv0.TeamTeamMember, len(members))
	for _, m := range members {
		if m.Name == "" {
			continue
		}
		out[m.Name] = m
	}
	return out
}

// teamMemberCreateOp builds a Zanzana create operation for a team member tuple.
//
// Permission is stringified blindly (parity with the old TeamBinding hook):
// TeamTeamPermission and TeamBindingTeamPermission are distinct Go enums with
// identical allowed values ("admin"/"member"). Unknown values are rejected by
// admission + toLegacyPermission under dual-write; in unified-only (Mode5)
// that gate is gone and we rely on Zanzana to reject. Tighten when Mode5 is default.
func teamMemberCreateOp(teamName string, m iamv0.TeamTeamMember) *v1.MutateOperation {
	return &v1.MutateOperation{
		// Proto op name is historical — Zanzana's schema only has
		// `team#member`/`team#admin` edges, so this really upserts a team-membership
		// tuple. Rename to *TeamMember* is a follow-up (touches the proto wire contract).
		Operation: &v1.MutateOperation_CreateTeamBinding{
			CreateTeamBinding: &v1.CreateTeamBindingOperation{
				SubjectName: m.Name,
				TeamName:    teamName,
				Permission:  string(m.Permission),
			},
		},
	}
}

// teamMemberDeleteOp builds a Zanzana delete operation for a team member tuple.
// See teamMemberCreateOp for notes on permission stringification and proto naming.
func teamMemberDeleteOp(teamName string, m iamv0.TeamTeamMember) *v1.MutateOperation {
	return &v1.MutateOperation{
		Operation: &v1.MutateOperation_DeleteTeamBinding{
			DeleteTeamBinding: &v1.DeleteTeamBindingOperation{
				SubjectName: m.Name,
				TeamName:    teamName,
				Permission:  string(m.Permission),
			},
		},
	}
}

// AfterTeamCreate is a post-create hook that writes the team's members to
// Zanzana (openFGA). team.spec.members is the source of truth for membership.
func (b *IdentityAccessManagementAPIBuilder) AfterTeamCreate(obj runtime.Object, _ *metav1.CreateOptions) {
	if b.zClient == nil {
		return
	}

	team, ok := obj.(*iamv0.Team)
	if !ok {
		b.logger.Error("failed to convert object to Team type", "object", obj)
		return
	}

	// Defensive: apiserver enforces non-empty Name/Namespace on namespace-scoped
	// resources, but skip rather than burn a ticket + goroutine on a tuple Zanzana
	// will reject (`team name cannot be empty` / no store for empty namespace).
	if team.Name == "" || team.Namespace == "" {
		b.logger.Warn("skipping zanzana sync for team with empty name or namespace",
			"namespace", team.Namespace,
			"name", team.Name,
		)
		return
	}

	if len(team.Spec.Members) == 0 {
		return
	}

	// Allocated on the apiserver hot path; could be deferred into the goroutine after the ticket grab if profiling shows this is a hot spot.
	operations := make([]*v1.MutateOperation, 0, len(team.Spec.Members))
	for _, m := range team.Spec.Members {
		if m.Name == "" {
			continue
		}
		operations = append(operations, teamMemberCreateOp(team.Name, m))
	}
	if len(operations) == 0 {
		return
	}

	resourceType := "team"
	operation := "create"

	// Grab a ticket to write to Zanzana
	// This limits the amount of concurrent connections to Zanzana
	wait := time.Now()
	b.zTickets <- true
	HooksWaitHistogram.WithLabelValues(resourceType, operation).Observe(time.Since(wait).Seconds())

	go func(namespace, teamName string, ops []*v1.MutateOperation) {
		start := time.Now()
		status := "success"

		defer func() {
			// Release the ticket after write is done
			<-b.zTickets
			// Record operation duration and count
			HooksDurationHistogram.WithLabelValues(resourceType, operation, status).Observe(time.Since(start).Seconds())
			HooksOperationCounter.WithLabelValues(resourceType, operation, status).Inc()
		}()

		b.logger.Debug("writing team members to zanzana",
			"namespace", namespace,
			"name", teamName,
			"members", len(ops),
		)
		for _, op := range ops {
			create := op.GetCreateTeamBinding()
			if create == nil {
				continue
			}
			b.logger.Debug("writing team binding to zanzana",
				"namespace", namespace,
				"name", teamName,
				"subject", create.SubjectName,
				"teamRef", create.TeamName,
				"permission", create.Permission,
			)
		}

		ctx, cancel := context.WithTimeout(context.Background(), DefaultWriteTimeout)
		defer cancel()

		err := b.zClient.Mutate(ctx, &v1.MutateRequest{
			Namespace:  namespace,
			Operations: ops,
		})
		if err != nil {
			status = "failure"
			b.logger.Error("failed to write team members to zanzana",
				"err", err,
				"namespace", namespace,
				"name", teamName,
			)
			return
		}
		// Record successful tuple writes
		HooksTuplesCounter.WithLabelValues(resourceType, operation, "write").Add(float64(len(ops)))
	}(team.Namespace, team.Name, operations)
}

// BeginTeamUpdate is a pre-update hook that diffs old and new team.spec.members
// and applies the resulting Zanzana mutations after the K8s update succeeds.
//
// MUST return a non-nil FinishFunc when err is nil — the apiserver dereferences
// it without a nil check (k8s.io/apiserver@v0.35.1 pkg/registry/generic/registry/store.go
// L740-L787).
//
// Use noopFinishUpdate for no-op branches (when there are no changes to sync).
//
// dualWriterMode changes where the panic lands:
// - foreground in Mode 4/5 (pkg/storage/legacysql/dualwrite/dualwriter.go:377) (bubbles panic to the caller)
// - background in Mode 1/2/3 (pkg/storage/legacysql/dualwrite/dualwriter.go:420) (swallows panic)
func (b *IdentityAccessManagementAPIBuilder) BeginTeamUpdate(_ context.Context, obj, oldObj runtime.Object, _ *metav1.UpdateOptions) (registry.FinishFunc, error) {
	if b.zClient == nil {
		return noopFinishUpdate, nil
	}

	oldTeam, ok := oldObj.(*iamv0.Team)
	if !ok {
		return noopFinishUpdate, nil
	}
	newTeam, ok := obj.(*iamv0.Team)
	if !ok {
		return noopFinishUpdate, nil
	}

	// See AfterTeamCreate: skip rather than send a guaranteed-bad mutation.
	if newTeam.Name == "" || newTeam.Namespace == "" {
		b.logger.Warn("skipping zanzana sync for team with empty name or namespace",
			"namespace", newTeam.Namespace,
			"name", newTeam.Name,
		)
		return noopFinishUpdate, nil
	}

	oldByName := teamMembersByName(oldTeam.Spec.Members)
	newByName := teamMembersByName(newTeam.Spec.Members)

	// Deletes need to use the OLD permission so the existing Zanzana tuple
	// is matched. A permission change becomes delete(old) + create(new).
	// Allocated on the apiserver hot path; could be deferred into the goroutine after the ticket grab if profiling shows this is a hot spot.
	operations := make([]*v1.MutateOperation, 0)
	for name, oldMember := range oldByName {
		newMember, stillPresent := newByName[name]
		if !stillPresent {
			operations = append(operations, teamMemberDeleteOp(oldTeam.Name, oldMember))
			continue
		}
		if oldMember.Permission != newMember.Permission {
			operations = append(operations, teamMemberDeleteOp(oldTeam.Name, oldMember))
			operations = append(operations, teamMemberCreateOp(newTeam.Name, newMember))
		}
	}
	for name, newMember := range newByName {
		if _, existed := oldByName[name]; existed {
			continue
		}
		operations = append(operations, teamMemberCreateOp(newTeam.Name, newMember))
	}

	if len(operations) == 0 {
		return noopFinishUpdate, nil
	}

	resourceType := "team"
	operation := "update"

	// Return a finish function that performs the zanzana write only on success
	return func(_ context.Context, success bool) {
		if !success {
			return
		}

		// Grab a ticket to write to Zanzana
		// This limits the amount of concurrent connections to Zanzana
		wait := time.Now()
		b.zTickets <- true
		HooksWaitHistogram.WithLabelValues(resourceType, operation).Observe(time.Since(wait).Seconds())

		go func(namespace, teamName string, ops []*v1.MutateOperation) {
			start := time.Now()
			status := "success"

			defer func() {
				// Release the ticket after write is done
				<-b.zTickets
				// Record operation duration and count
				HooksDurationHistogram.WithLabelValues(resourceType, operation, status).Observe(time.Since(start).Seconds())
				HooksOperationCounter.WithLabelValues(resourceType, operation, status).Inc()
			}()

			b.logger.Debug("updating team members in zanzana",
				"namespace", namespace,
				"name", teamName,
				"operations", len(ops),
			)
			for _, op := range ops {
				if del := op.GetDeleteTeamBinding(); del != nil {
					b.logger.Debug("deleting team binding from zanzana",
						"namespace", namespace,
						"name", teamName,
						"subject", del.SubjectName,
						"teamRef", del.TeamName,
						"permission", del.Permission,
					)
					continue
				}
				if create := op.GetCreateTeamBinding(); create != nil {
					b.logger.Debug("writing team binding to zanzana",
						"namespace", namespace,
						"name", teamName,
						"subject", create.SubjectName,
						"teamRef", create.TeamName,
						"permission", create.Permission,
					)
				}
			}

			ctx, cancel := context.WithTimeout(context.Background(), DefaultWriteTimeout)
			defer cancel()

			// Only make the request if there are deletes or writes
			err := b.zClient.Mutate(ctx, &v1.MutateRequest{
				Namespace:  namespace,
				Operations: ops,
			})
			if err != nil {
				status = "failure"
				b.logger.Error("failed to update team members in zanzana",
					"err", err,
					"namespace", namespace,
					"name", teamName,
				)
				return
			}
			// Record successful tuple operations
			for _, op := range ops {
				switch op.Operation.(type) {
				case *v1.MutateOperation_CreateTeamBinding:
					HooksTuplesCounter.WithLabelValues(resourceType, operation, "write").Inc()
				case *v1.MutateOperation_DeleteTeamBinding:
					HooksTuplesCounter.WithLabelValues(resourceType, operation, "delete").Inc()
				}
			}
		}(newTeam.Namespace, newTeam.Name, operations)
	}, nil
}

// AfterTeamDelete is a post-delete hook that removes all team member tuples
// for the deleted team from Zanzana (openFGA).
func (b *IdentityAccessManagementAPIBuilder) AfterTeamDelete(obj runtime.Object, _ *metav1.DeleteOptions) {
	if b.zClient == nil {
		return
	}

	team, ok := obj.(*iamv0.Team)
	if !ok {
		b.logger.Error("failed to convert object to Team type", "object", obj)
		return
	}

	// See AfterTeamCreate: skip rather than send a guaranteed-bad mutation.
	if team.Name == "" || team.Namespace == "" {
		b.logger.Warn("skipping zanzana sync for team with empty name or namespace",
			"namespace", team.Namespace,
			"name", team.Name,
		)
		return
	}

	if len(team.Spec.Members) == 0 {
		return
	}

	// Allocated on the apiserver hot path; could be deferred into the goroutine after the ticket grab if profiling shows this is a hot spot.
	operations := make([]*v1.MutateOperation, 0, len(team.Spec.Members))
	for _, m := range team.Spec.Members {
		if m.Name == "" {
			continue
		}
		operations = append(operations, teamMemberDeleteOp(team.Name, m))
	}
	if len(operations) == 0 {
		return
	}

	resourceType := "team"
	operation := "delete"

	// Grab a ticket to write to Zanzana
	// This limits the amount of concurrent connections to Zanzana
	wait := time.Now()
	b.zTickets <- true
	HooksWaitHistogram.WithLabelValues(resourceType, operation).Observe(time.Since(wait).Seconds())

	go func(namespace, teamName string, ops []*v1.MutateOperation) {
		start := time.Now()
		status := "success"

		defer func() {
			// Release the ticket after write is done
			<-b.zTickets
			// Record operation duration and count
			HooksDurationHistogram.WithLabelValues(resourceType, operation, status).Observe(time.Since(start).Seconds())
			HooksOperationCounter.WithLabelValues(resourceType, operation, status).Inc()
		}()

		b.logger.Debug("deleting team members from zanzana",
			"namespace", namespace,
			"name", teamName,
			"members", len(ops),
		)
		for _, op := range ops {
			del := op.GetDeleteTeamBinding()
			if del == nil {
				continue
			}
			b.logger.Debug("deleting team binding from zanzana",
				"namespace", namespace,
				"name", teamName,
				"subject", del.SubjectName,
				"teamRef", del.TeamName,
				"permission", del.Permission,
			)
		}

		ctx, cancel := context.WithTimeout(context.Background(), DefaultWriteTimeout)
		defer cancel()

		err := b.zClient.Mutate(ctx, &v1.MutateRequest{
			Namespace:  namespace,
			Operations: ops,
		})
		if err != nil {
			status = "failure"
			b.logger.Error("failed to delete team members from zanzana",
				"err", err,
				"namespace", namespace,
				"name", teamName,
			)
			return
		}
		// Record successful tuple deletions
		HooksTuplesCounter.WithLabelValues(resourceType, operation, "delete").Add(float64(len(ops)))
	}(team.Namespace, team.Name, operations)
}
