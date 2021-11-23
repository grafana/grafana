//go:build integration
// +build integration

package sqlstore

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/models"

	"github.com/stretchr/testify/require"
)

func TestSavingTags(t *testing.T) {
	InitTestDB(t)

	tagPairs := []*models.Tag{
		{Key: "outage"},
		{Key: "type", Value: "outage"},
		{Key: "server", Value: "server-1"},
		{Key: "error"},
	}
	tags, err := EnsureTagsExist(newSession(context.Background()), tagPairs)

	require.Nil(t, err)
	require.Equal(t, 4, len(tags))
}
