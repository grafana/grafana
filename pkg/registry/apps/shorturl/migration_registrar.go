package shorturl

import (
	shorturl "github.com/grafana/grafana/apps/shorturl/pkg/apis/shorturl/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apps/shorturl/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func ShortURLMigration(migrator migrator.ShortURLMigrator) migrations.MigrationDefinition {
	shortURLGR := schema.GroupResource{Group: shorturl.APIGroup, Resource: "shorturls"}

	return migrations.MigrationDefinition{
		ID:          "shorturls",
		MigrationID: "shorturls migration",
		Resources: []migrations.ResourceInfo{
			{GroupResource: shortURLGR, LockTables: []string{"short_url"}},
		},
		Migrators: map[schema.GroupResource]migrations.MigratorFunc{
			shortURLGR: migrator.MigrateShortURLs,
		},
		Validators: []migrations.ValidatorFactory{
			migrations.CountValidation(shortURLGR, "short_url", "org_id = ?"),
		},
	}
}
