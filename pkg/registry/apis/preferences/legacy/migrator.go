package legacy

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"

	"k8s.io/apimachinery/pkg/runtime/schema"

	preferencesV1 "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func PreferencesMigrationDefinition(migrator PreferencesMigrator) migrations.MigrationDefinition {
	preferencesGR := schema.GroupResource{Group: preferencesV1.APIGroup, Resource: "preferences"}

	return migrations.MigrationDefinition{
		ID:          "preferences",
		MigrationID: "preferences migration",
		Resources: []migrations.ResourceInfo{
			{GroupResource: preferencesGR, LockTables: []string{"preferences", "user", "team"}},
		},
		Migrators: map[schema.GroupResource]migrations.MigratorFunc{
			preferencesGR: migrator.MigratePreferences,
		},
		Validators: []migrations.ValidatorFactory{
			// Strict count parity using a custom query that mirrors the read
			// path: counts every row the migrator emits a resource for
			// (namespace + valid user + valid team), excluding orphans.
			preferencesCountValidation(preferencesGR),
		},
		RenameTables: []string{},
	}
}

type PreferencesMigrator interface {
	MigratePreferences(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error
}

// preferencesMigrator handles migrating preferences from legacy SQL storage.
type preferencesMigrator struct {
	sql legacysql.LegacyDatabaseProvider
}

// ProvidePreferencesMigrator creates a preferencesMigrator for use in wire DI.
func ProvidePreferencesMigrator(sql legacysql.LegacyDatabaseProvider) PreferencesMigrator {
	return &preferencesMigrator{sql: sql}
}

// MigratePreferences reads preferences from legacy SQL storage and streams them as
// Kubernetes resources to the unified storage bulk process API.
func (m *preferencesMigrator) MigratePreferences(ctx context.Context, _ int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
	opts.Progress(-1, "migrating preferences...")

	sql := NewLegacySQL(m.sql)

	all, err := sql.ListPreferences(ctx, opts.Namespace, nil, false)
	if err != nil {
		return err
	}

	for i, pref := range all.Items {
		obj, err := utils.MetaAccessor(&pref)
		if err != nil {
			return err
		}
		pref.APIVersion = preferencesV1.GroupVersion.String()
		pref.Kind = "Preferences"

		body, err := json.Marshal(&pref)
		if err != nil {
			return err
		}

		req := &resourcepb.BulkRequest{
			Key: &resourcepb.ResourceKey{
				Namespace: opts.Namespace,
				Group:     preferencesV1.APIGroup,
				Resource:  "preferences",
				Name:      obj.GetName(),
			},
			Value:  body,
			Action: resourcepb.BulkRequest_ADDED,
		}

		opts.Progress(i, fmt.Sprintf("%s (%d)", obj.GetName(), len(req.Value)))
		err = stream.Send(req)
		if err != nil {
			if errors.Is(err, io.EOF) {
				err = nil
			}
			return err
		}
	}

	opts.Progress(-2, fmt.Sprintf("finished preferences... (%d)", len(all.Items)))
	return nil
}
