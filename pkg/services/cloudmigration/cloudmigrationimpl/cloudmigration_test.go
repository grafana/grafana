package cloudmigrationimpl

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/stretchr/testify/assert"
)

func Test_NoopServiceDoesNothing(t *testing.T) {
	s := &NoopServiceImpl{}
	_, e := s.MigrateDatasources(context.Background(), &cloudmigration.MigrateDatasourcesRequest{})
	assert.ErrorIs(t, e, cloudmigration.ErrFeatureDisabledError)
}
