package utils

import (
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"

	"github.com/stretchr/testify/require"
)

func TestCheckOrgExists(t *testing.T) {
	t.Run("with default org in database", func(t *testing.T) {
		sqlstore.InitTestDB(t)

		defaultOrg := models.CreateOrgCommand{Name: "Main Org."}
		err := sqlstore.CreateOrg(&defaultOrg)
		require.NoError(t, err)

		t.Run("default org exists", func(t *testing.T) {
			err := CheckOrgExists(defaultOrg.Result.Id)
			require.NoError(t, err)
		})

		t.Run("other org doesn't exist", func(t *testing.T) {
			err := CheckOrgExists(defaultOrg.Result.Id + 1)
			require.Equal(t, err, models.ErrOrgNotFound)
		})
	})
}
