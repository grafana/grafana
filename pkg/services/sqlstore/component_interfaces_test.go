package sqlstore

import (
	"context"
	"testing"

	"github.com/grafana/grafana/internal/components/datasource"
	"github.com/stretchr/testify/require"
)

func TestStoreDSSomeHowMaybe(t *testing.T) {

	t.Run("something", func(t *testing.T) {
		sqlStore := InitTestDB(t)

		dsStore := datasource.Store(ProvideDataSourceSchemaStore(sqlStore))

		uid := "MySpecialUIDisDEARtoMe"
		jd := make(map[string]interface{})
		jd["test"] = "test"

		modelToInsert := datasource.DataSource{
			Name:     "Test",
			UID:      uid,
			JsonData: jd,
		}

		err := dsStore.Insert(context.Background(), modelToInsert)
		require.NoError(t, err)

		fetchedDS, err := dsStore.Get(context.Background(), uid)
		require.NoError(t, err)
		require.Equal(t, modelToInsert, fetchedDS)
	})

}
