package promtypemigration

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/stretchr/testify/assert"
)

func TestGetPrometheusDataSources_Amazon_ReturnsOnlyAmazonPrometheus(t *testing.T) {
	ds1 := &datasources.DataSource{
		JsonData: simplejson.NewFromAny(map[string]any{
			"sigV4Auth": true,
		}),
	}
	ds2 := &datasources.DataSource{
		JsonData: simplejson.NewFromAny(map[string]any{
			"sigV4Auth": false,
		}),
	}
	ds3 := &datasources.DataSource{
		JsonData: simplejson.NewFromAny(map[string]any{
			"sigV4Auth": true,
		}),
	}
	ds4 := &datasources.DataSource{
		JsonData: simplejson.NewFromAny(map[string]any{
			"sigV4Auth": nil,
		}),
	}
	mock := &mockDataSourcesService{
		dataSources: []*datasources.DataSource{ds1, ds2, ds3, ds4},
	}
	svc := &AmazonPromMigrationService{
		promMigrationService: promMigrationService{
			dataSourcesService: mock,
		},
	}

	got, err := svc.getPrometheusDataSources(context.Background())
	assert.NoError(t, err)
	assert.Len(t, got, 2)
	assert.Contains(t, got, ds1)
	assert.Contains(t, got, ds3)
}

func TestGetPrometheusDataSources_Amazon_ErrorFromService(t *testing.T) {
	mockSvc := &mockDataSourcesService{
		err: errors.New("service error"),
	}
	svc := &AmazonPromMigrationService{
		promMigrationService: promMigrationService{
			dataSourcesService: mockSvc,
		},
	}

	got, err := svc.getPrometheusDataSources(context.Background())
	assert.Error(t, err)
	assert.Nil(t, got)
}

func TestGetPrometheusDataSources_Amazon_NoSigV4Auth(t *testing.T) {
	ds := &datasources.DataSource{
		JsonData: simplejson.NewFromAny(map[string]any{}),
	}
	mockSvc := &mockDataSourcesService{
		dataSources: []*datasources.DataSource{ds},
	}
	svc := &AmazonPromMigrationService{
		promMigrationService: promMigrationService{
			dataSourcesService: mockSvc,
		},
	}

	got, err := svc.getPrometheusDataSources(context.Background())
	assert.NoError(t, err)
	assert.Empty(t, got)
}
