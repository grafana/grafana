package datasource

import (
	"context"
	"fmt"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry/apis/datasource/converter"
	"github.com/grafana/grafana/pkg/services/datasources"
)

func TestScopedDatasourceProviderSetsSkipDefaultPermissions(t *testing.T) {
	for _, skip := range []bool{false, true} {
		t.Run(fmt.Sprintf("skip=%t", skip), func(t *testing.T) {
			service := &addDatasourceCommandCapture{}
			providerFactory := &cachingDatasourceProvider{
				dsService: service,
				converter: converter.NewConverter(func(int64) string { return "default" }, "", "", nil),
			}
			provider := providerFactory.GetDatasourceProvider(plugins.JSONData{ID: "test"}, skip)
			ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
				Type: authlib.TypeUser, UserID: 12, UserUID: "stable-user-uid", OrgID: 1,
			})
			_, err := provider.CreateDataSource(ctx, &datasourceV0.DataSource{
				ObjectMeta: metav1.ObjectMeta{Name: "ds-uid", Namespace: "default"},
			})
			require.NoError(t, err)
			require.NotNil(t, service.command)
			require.Equal(t, "ds-uid", service.command.UID)
			require.Equal(t, int64(1), service.command.OrgID)
			require.Equal(t, skip, service.command.SkipDefaultPermissions)
		})
	}
}

type addDatasourceCommandCapture struct {
	datasources.DataSourceService
	command *datasources.AddDataSourceCommand
}

func (s *addDatasourceCommandCapture) AddDataSource(_ context.Context, cmd *datasources.AddDataSourceCommand) (*datasources.DataSource, error) {
	s.command = cmd
	return &datasources.DataSource{UID: cmd.UID, OrgID: cmd.OrgID, Name: cmd.Name, Type: cmd.Type}, nil
}
