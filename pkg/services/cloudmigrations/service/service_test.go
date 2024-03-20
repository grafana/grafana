package service

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/cloudmigrations/models"
	"github.com/stretchr/testify/assert"
)

func Test_NoopServiceDoesNothing(t *testing.T) {
	s := &NoopServiceImpl{}
	_, e := s.MigrateDatasources(context.Background(), &models.MigrateDatasourcesRequest{})
	assert.ErrorIs(t, e, models.ErrFeatureDisabledError)
}
