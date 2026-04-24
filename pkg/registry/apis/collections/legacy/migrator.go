package legacy

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strconv"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"

	collectionsV1 "github.com/grafana/grafana/apps/collections/pkg/apis/collections/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func StarsMigrationDefinition(migrator StarsMigrator) migrations.MigrationDefinition {
	starsGR := schema.GroupResource{Group: collectionsV1.APIGroup, Resource: "stars"}

	return migrations.MigrationDefinition{
		ID:          "stars",
		MigrationID: "stars migration",
		Resources: []migrations.ResourceInfo{
			{GroupResource: starsGR, LockTables: []string{"star", "user"}},
		},
		Migrators: map[schema.GroupResource]migrations.MigratorFunc{
			starsGR: migrator.MigrateStars,
		},
		Validators: []migrations.ValidatorFactory{
			migrations.CountValidation(starsGR, migrations.CountValidationOptions{
				Table:    "star",
				Where:    "org_id = ?",
				Distinct: "user_id",
			}),
		},
		RenameTables: []string{},
	}
}

type StarsMigrator interface {
	MigrateStars(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error
}

// starsMigrator handles migrating playlists from legacy SQL storage.
type starsMigrator struct {
	sql legacysql.LegacyDatabaseProvider
}

// ProvideStarsMigrator creates a starsMigrator for use in wire DI.
func ProvideStarsMigrator(sql legacysql.LegacyDatabaseProvider) StarsMigrator {
	return &starsMigrator{sql: sql}
}

// MigrateStars reads stars from legacy SQL storage and streams them as
// Kubernetes resources to the unified storage bulk process API.
func (m *starsMigrator) MigrateStars(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
	opts.Progress(-1, "migrating stars...")

	ctx = request.WithNamespace(ctx, opts.Namespace)
	sql := NewLegacySQL(m.sql)
	store := NewDashboardStarsStorage(nil, nil, func(int64) string {
		return opts.Namespace // static namespace
	}, sql)

	ts, err := sql.GetMaxTime(ctx)
	if err != nil {
		return err
	}
	rv := (ts.UnixMilli() / 1000000 * 1000000) + (orgId * 10000) // ensure unique RV across orgs

	// 1. list all users with stars (in this org)
	users, err := sql.ListUsers(ctx, orgId)
	if err != nil {
		return err
	}

	for i, user := range users {
		s, err := store.Get(ctx, "user-"+user, &metav1.GetOptions{})
		if err != nil {
			return err
		}

		rv++
		obj, err := utils.MetaAccessor(s)
		if err != nil {
			return err
		}
		obj.SetResourceVersion(strconv.FormatInt(rv, 10))

		body, err := json.Marshal(s)
		if err != nil {
			return err
		}

		req := &resourcepb.BulkRequest{
			Key: &resourcepb.ResourceKey{
				Namespace: opts.Namespace,
				Group:     collectionsV1.APIGroup,
				Resource:  "stars",
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

	opts.Progress(-2, fmt.Sprintf("finished stars... (%d)", len(users)))
	return nil
}
