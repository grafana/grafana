package myresource

import (
	myresourcev1beta1 "github.com/grafana/grafana/apps/myresource/pkg/apis/myresource/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apps/myresource/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func MyResourceMigration(migrator migrator.MyResourceMigrator) migrations.MigrationDefinition {
	myResourceGR := schema.GroupResource{Group: myresourcev1beta1.APIGroup, Resource: "myresources"}

	return migrations.MigrationDefinition{
		ID:          "myresources",
		MigrationID: "myresources migration",
		Resources: []migrations.ResourceInfo{
			{GroupResource: myResourceGR, LockTable: "my_resource"},
		},
		Migrators: map[schema.GroupResource]migrations.MigratorFunc{
			myResourceGR: migrator.MigrateMyResources,
		},
		Validators: []migrations.ValidatorFactory{
			migrations.CountValidation(myResourceGR, "my_resource", "org_id = ?"),
		},
	}
}
