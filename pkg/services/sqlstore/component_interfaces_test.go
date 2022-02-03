package sqlstore

import (
	"testing"
)

func TestStoreDSSomeHowMaybe(t *testing.T) {

	t.Run("something", func(t *testing.T) {
		sqlStore := InitTestDB(t)

		sd := ProvideDataSourceSchemaStore(sqlStore)
		ds, _ := sd.Get("")
		_ = ds

	})

}
