//go:build integration
// +build integration

package sqlstore

import (
	"context"
	"strconv"
	"testing"

	"github.com/grafana/grafana/internal/components/datasource"
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/types"
)

func TestStoreDSStoreCRUD(t *testing.T) {
	t.Run("Insert / Update / Delete with Gets", func(t *testing.T) {
		sqlStore := InitTestDB(t)
		ctx := context.Background()
		dsStore := datasource.Store(ProvideDataSourceSchemaStore(sqlStore))

		uid := "MySpecialUIDisDEARtoMe"
		jd := make(map[string]interface{})
		jd["test"] = "test"

		modelToInsert := datasource.CR{
			Spec: datasource.Model{
				JsonData: jd,
			},
		}
		modelToInsert.Name = "Test"
		modelToInsert.UID = types.UID(uid)

		// Insert
		err := dsStore.Insert(ctx, modelToInsert)
		require.NoError(t, err)

		// Get
		fetchedDS, err := dsStore.Get(ctx, uid)
		require.NoError(t, err)

		modelToInsertWithVersionBumped := datasource.CR{
			Spec: datasource.Model{
				JsonData: jd,
			},
		}
		modelToInsertWithVersionBumped.Name = "Test"
		modelToInsertWithVersionBumped.UID = types.UID(uid)
		modelToInsertWithVersionBumped.ResourceVersion = strconv.Itoa(1)

		require.Equal(t, modelToInsertWithVersionBumped, fetchedDS)

		// Update
		modelForUpdate := datasource.CR{
			Spec: datasource.Model{
				JsonData: jd,
				Type:     "slothFactory",
			},
		}
		modelForUpdate.Name = "Test"
		modelForUpdate.UID = types.UID(uid)
		modelForUpdate.ResourceVersion = fetchedDS.ResourceVersion // We are manually setting version

		err = dsStore.Update(ctx, modelForUpdate)
		require.NoError(t, err)

		// Get updated
		modelForUpdateWithVersionBump := datasource.CR{
			Spec: datasource.Model{
				JsonData: jd,
				Type:     "slothFactory",
			},
		}
		modelForUpdateWithVersionBump.Name = "Test"
		modelForUpdateWithVersionBump.UID = types.UID(uid)
		rv, err := strconv.Atoi(fetchedDS.ResourceVersion)
		require.NoError(t, err)
		modelForUpdateWithVersionBump.ResourceVersion = strconv.Itoa(rv + 1) // We are manually setting version

		fetchedUpdatedDS, err := dsStore.Get(ctx, uid)
		require.NoError(t, err)
		require.Equal(t, modelForUpdateWithVersionBump, fetchedUpdatedDS)

		// Delete it
		err = dsStore.Delete(ctx, uid)
		require.NoError(t, err)

		_, err = dsStore.Get(ctx, uid)
		require.ErrorIs(t, err, models.ErrDataSourceNotFound)
	})
}
