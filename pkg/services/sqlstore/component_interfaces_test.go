//go:build integration
// +build integration

package sqlstore

import (
	"context"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/internal/coremodel/datasource"
	datasourcecrd "github.com/grafana/grafana/internal/coremodel/datasource/crd"
	"github.com/grafana/grafana/internal/framework/kubecontroller"
	"github.com/grafana/grafana/pkg/models"
)

func TestStoreDSStoreCRUD(t *testing.T) {
	ctx := context.Background()
	sqlStore := InitTestDB(t)
	dsStore := kubecontroller.Store(ProvideDataSourceSchemaStore(sqlStore))

	uid := types.UID("MySpecialUIDisDEARtoMe")
	name := "test-datasource"
	jd := `{"test":"value"}`
	nsName := types.NamespacedName{
		Namespace: "default",
		Name:      name,
	}

	t.Run("should insert the datasource into store", func(t *testing.T) {
		modelToInsert := datasourcecrd.Datasource{
			Spec: datasource.Model{
				JsonData: jd,
			},
		}
		modelToInsert.Name = name
		modelToInsert.UID = uid
		assert.NoError(t, dsStore.Insert(ctx, &modelToInsert))

		var fetchedDS datasourcecrd.Datasource
		assert.NoError(t, dsStore.Get(ctx, nsName, &fetchedDS))

		modelToInsertWithVersionBumped := datasourcecrd.Datasource{
			Spec: datasource.Model{
				JsonData: jd,
			},
		}
		modelToInsertWithVersionBumped.Name = name
		modelToInsertWithVersionBumped.UID = uid
		modelToInsertWithVersionBumped.ResourceVersion = strconv.Itoa(1)

		assert.Equal(t, modelToInsertWithVersionBumped, fetchedDS)
	})

	t.Run("should update the datasource in store", func(t *testing.T) {
		var fetchedDS datasourcecrd.Datasource
		assert.NoError(t, dsStore.Get(ctx, nsName, &fetchedDS))

		modelForUpdate := datasourcecrd.Datasource{
			Spec: datasource.Model{
				JsonData: jd,
				Type:     "slothFactory",
			},
		}
		modelForUpdate.Name = name
		modelForUpdate.UID = uid
		modelForUpdate.ResourceVersion = fetchedDS.ResourceVersion // We are manually setting version

		assert.NoError(t, dsStore.Update(ctx, &modelForUpdate))

		modelForUpdateWithVersionBump := datasourcecrd.Datasource{
			Spec: datasource.Model{
				JsonData: jd,
				Type:     "slothFactory",
			},
		}
		modelForUpdateWithVersionBump.Name = name
		modelForUpdateWithVersionBump.UID = uid
		rv, err := strconv.Atoi(fetchedDS.ResourceVersion)
		assert.NoError(t, err)
		modelForUpdateWithVersionBump.ResourceVersion = strconv.Itoa(rv + 1) // We are manually setting version

		var fetchedUpdatedDS datasourcecrd.Datasource
		assert.NoError(t, dsStore.Get(ctx, nsName, &fetchedUpdatedDS))
		assert.Equal(t, modelForUpdateWithVersionBump, fetchedUpdatedDS)
	})

	t.Run("should delete the datasource from store", func(t *testing.T) {
		var fetchedDS datasourcecrd.Datasource
		assert.NoError(t, dsStore.Delete(ctx, nsName))
		assert.ErrorIs(t, dsStore.Get(ctx, nsName, &fetchedDS), models.ErrDataSourceNotFound)
	})
}
