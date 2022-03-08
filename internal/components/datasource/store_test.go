//go:build integration
// +build integration

package datasource

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestStoreDSStoreCRUD(t *testing.T) {
	t.Run("Insert / Update / Delete with Gets", func(t *testing.T) {
		sqlStore := sqlstore.InitTestDB(t)
		ctx := context.Background()
		dsStore := ProvideDataSourceSchemaStore(sqlStore)

		uid := "MySpecialUIDisDEARtoMe"
		jd := make(map[string]interface{})
		jd["test"] = "test"

		modelToInsert := Datasource{
			ObjectMeta: metav1.ObjectMeta{
				Name: uid,
			},
			Spec: Model{
				Name: "Test",
				JsonData: jd,
			},
		}

		// Insert
		err := dsStore.Insert(ctx, &modelToInsert)
		require.NoError(t, err)

		// Get
		fetchedObject, err := dsStore.Get(ctx, uid)
		require.NoError(t, err)

		fetchedDS, ok := fetchedObject.(*Datasource)
		require.True(t, ok)

		modelToInsertWithVersionBumped := Datasource{
			ObjectMeta: metav1.ObjectMeta{
				Name: uid,
				ResourceVersion: "1",
			},
			Spec: Model{
				Name: "Test",
				JsonData: jd,
			},
		}

		require.Equal(t, &modelToInsertWithVersionBumped, fetchedDS)

		// Update
		modelForUpdate := Datasource{
			ObjectMeta: metav1.ObjectMeta{
				Name: uid,
				ResourceVersion: fetchedDS.ResourceVersion,
			},
			Spec: Model{
				Name: "Test",
				JsonData: jd,
				Type:     "slothFactory",
			},
		}

		err = dsStore.Update(ctx, &modelForUpdate)
		require.NoError(t, err)

		// Get updated
		modelForUpdateWithVersionBump := Datasource{
			ObjectMeta: metav1.ObjectMeta{
				Name: uid,
				ResourceVersion: "2",
			},
			Spec: Model{
				Name: "Test",
				JsonData: jd,
				Type:     "slothFactory",
			},
		}

		fetchedUpdatedDS, err := dsStore.Get(ctx, uid)
		require.NoError(t, err)
		require.Equal(t, &modelForUpdateWithVersionBump, fetchedUpdatedDS)

		// Delete it
		err = dsStore.Delete(ctx, uid)
		require.NoError(t, err)

		_, err = dsStore.Get(ctx, uid)
		require.ErrorIs(t, err, models.ErrDataSourceNotFound)
	})
}
