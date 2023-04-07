package plugincontext

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type KeyProvider interface {
	DataSourceKey(ctx context.Context, dsSettings *backend.DataSourceInstanceSettings) string
	AppKey(ctx context.Context, pluginID string, orgID int64) string
}

func ProvideKeyService() *KeyService {
	return &KeyService{}
}

type KeyService struct {
}

func (s *KeyService) DataSourceKey(_ context.Context, dsSettings *backend.DataSourceInstanceSettings) string {
	return fmt.Sprint(dsSettings.ID)
}

func (s *KeyService) AppKey(_ context.Context, pluginID string, orgID int64) string {
	return fmt.Sprintf("%s#%v", pluginID, orgID)
}
