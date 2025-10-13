package models

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPublicDashboardTableName(t *testing.T) {
	assert.Equal(t, "dashboard_public", PublicDashboard{}.TableName())
}
