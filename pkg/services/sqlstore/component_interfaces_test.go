package sqlstore

import (
	"context"
	"testing"

	"github.com/grafana/grafana/internal/components/datasource"
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestStoreDSStoreCRUD(t *testing.T) {
	t.Run("Insert / Update / Delete with Gets", func(t *testing.T) {
		sqlStore := InitTestDB(t)
		ctx := context.Background()
		dsStore := datasource.Store(ProvideDataSourceSchemaStore(sqlStore))

		uid := "MySpecialUIDisDEARtoMe"
		jd := make(map[string]interface{})
		jd["test"] = "test"

		modelToInsert := datasource.DataSource{
			Name:     "Test",
			UID:      uid,
			JsonData: jd,
		}

		// Insert
		err := dsStore.Insert(ctx, modelToInsert)
		require.NoError(t, err)

		// Get
		fetchedDS, err := dsStore.Get(ctx, uid)
		require.NoError(t, err)

		modelToInsertWithVersionBumped := datasource.DataSource{
			Name:     "Test",
			UID:      uid,
			JsonData: jd,
			Version:  1,
		}

		require.Equal(t, modelToInsertWithVersionBumped, fetchedDS)

		// Update
		modelForUpdate := datasource.DataSource{
			Name:     "Test",
			UID:      uid,
			JsonData: jd,
			Type:     "slothFactory",
			Version:  fetchedDS.Version, // We are manually setting version
		}

		err = dsStore.Update(ctx, modelForUpdate)
		require.NoError(t, err)

		// Get updated
		modelForUpdateWithVersionBump := datasource.DataSource{
			Name:     "Test",
			UID:      uid,
			JsonData: jd,
			Type:     "slothFactory",
			Version:  fetchedDS.Version + 1, // We are manually setting version
		}
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
