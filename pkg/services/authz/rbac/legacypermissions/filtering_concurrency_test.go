package legacypermissions

import (
	"context"
	"errors"
	"testing"
	"testing/synctest"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/localcache"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

type filteringFeatureProvider struct{ openfeature.NoopProvider }

func (filteringFeatureProvider) BooleanEvaluation(_ context.Context, flag string, fallback bool, ctx openfeature.FlattenedContext) openfeature.BoolResolutionDetail {
	if flag == featuremgmt.FlagExcludeRedundantManagedPermissions {
		return openfeature.BoolResolutionDetail{Value: ctx[openfeature.TargetingKey] == "enabled"}
	}
	return openfeature.BoolResolutionDetail{Value: fallback}
}

func TestFilteringSeparatesConcurrentAssemblies(t *testing.T) {
	require.NoError(t, openfeature.SetProviderAndWait(filteringFeatureProvider{}))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
	synctest.Test(t, func(t *testing.T) {
		release := make(chan struct{})
		disabledErr, enabledErr := errors.New("unfiltered lookup"), errors.New("filtered lookup")
		cfg := setting.NewCfg()
		cfg.RBAC.PermissionCache = true
		loader := newLoader(func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
			if openfeature.TransactionContext(ctx).TargetingKey() == "enabled" {
				return nil, enabledErr
			}
			<-release
			return nil, disabledErr
		}, nil, localcache.New(0, 0), cfg, nil, WithLicensing(&licensing.OSSLicensingService{}), WithRoleCatalog(NewRoleCatalog()))
		requester := &user.SignedInUser{UserID: 7, OrgID: 1, OrgRole: org.RoleNone}
		off, on := make(chan error, 1), make(chan error, 1)
		load := func(target string, result chan<- error) {
			ctx := openfeature.WithTransactionContext(t.Context(), openfeature.NewEvaluationContext(target, nil))
			_, err := loader.GetUserPermissions(ctx, requester, ac.Options{})
			result <- err
		}
		go load("disabled", off)
		synctest.Wait()
		go load("enabled", on)
		synctest.Wait()
		select {
		case err := <-on:
			assert.ErrorIs(t, err, enabledErr)
		default:
			t.Error("filtered request joined an unfiltered assembly")
		}
		close(release)
		synctest.Wait()
		require.ErrorIs(t, <-off, disabledErr)
	})
}
