package sqlstore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/assert"
)

func TestDataKeys(t *testing.T) {
	db := InitTestDB(t)
	ctx := context.Background()

	dataKey := models.DataKey{
		Active:        true,
		Name:          "Testing",
		Provider:      "test",
		EncryptedData: []byte{0x62, 0xAF, 0xA1, 0x1A},
	}

	res, err := db.GetDataKey(ctx, dataKey.Name)
	assert.Equal(t, models.ErrDataKeyNotFound, err)
	assert.Nil(t, res)

	err = db.CreateDataKey(ctx, dataKey)
	require.NoError(t, err)

	res, err = db.GetDataKey(ctx, dataKey.Name)
	require.NoError(t, err)
	assert.Equal(t, dataKey.EncryptedData, res.EncryptedData)
	assert.Equal(t, dataKey.Provider, res.Provider)
	assert.Equal(t, dataKey.Name, res.Name)
	assert.True(t, dataKey.Active)

	err = db.DeleteDataKey(ctx, dataKey.Name)
	require.NoError(t, err)

	res, err = db.GetDataKey(ctx, dataKey.Name)
	assert.Equal(t, models.ErrDataKeyNotFound, err)
	assert.Nil(t, res)
}
