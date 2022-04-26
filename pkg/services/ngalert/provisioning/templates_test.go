package provisioning

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	mock "github.com/stretchr/testify/mock"
)

func TestTemplateService(t *testing.T) {
	t.Run("getting templates", func(t *testing.T) {
		sut := createTemplateServiceSut()
		sut.config.(*MockAMConfigStore).EXPECT().
			GetLatestAlertmanagerConfiguration(mock.Anything, mock.Anything).
			Run(func(ctx context.Context, q *models.GetLatestAlertmanagerConfigurationQuery) {
				q.Result = &models.AlertConfiguration{}
			}).
			Return(nil)
	})
}

func createTemplateServiceSut() *TemplateService {
	return &TemplateService{
		config: &MockAMConfigStore{},
		prov:   newFakeProvisioningStore(),
		xact:   newNopTransactionManager(),
		log:    log.NewNopLogger(),
	}
}
