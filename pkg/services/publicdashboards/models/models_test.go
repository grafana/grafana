package models

import (
	"github.com/stretchr/testify/assert"
	"testing"
)

func TestPublicDashboardTableName(t *testing.T) {
	assert.Equal(t, "dashboard_public", PublicDashboard{}.TableName())
}
