package store_test

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/tests"
	"github.com/stretchr/testify/require"
)

const testAlertingIntervalSeconds = 10

func TestProvisioningStore(t *testing.T) {
	_, dbstore := tests.SetupTestEnv(t, testAlertingIntervalSeconds)

	t.Run("Provenance of an unknown type is always None", func(t *testing.T) {
		provenance, err := dbstore.GetProvenance(randomStruct{})

		require.NoError(t, err)
		require.Equal(t, models.None, provenance)
	})

	t.Run("Default provenance of a known type is None", func(t *testing.T) {
		rule := models.AlertRule{
			UID: "asdf",
		}

		provenance, err := dbstore.GetProvenance(rule)

		require.NoError(t, err)
		require.Equal(t, models.None, provenance)
	})

	t.Run("Store returns saved provenance type", func(t *testing.T) {
		rule := models.AlertRule{
			UID: "123",
		}
		err := dbstore.SetProvenance(rule, models.File)
		require.NoError(t, err)

		p, err := dbstore.GetProvenance(rule)

		require.NoError(t, err)
		require.Equal(t, models.File, p)
	})
}

type randomStruct struct{}
