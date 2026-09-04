package config

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/validation"
)

func configWithUID(name, uid string) *v0alpha1.Config {
	c := &v0alpha1.Config{ObjectMeta: metav1.ObjectMeta{Name: name}}
	if uid != "" {
		c.Spec.ExternalRulerSync = &v0alpha1.ConfigV0alpha1SpecExternalRulerSync{DatasourceUid: &uid}
	}
	return c
}

func configWithPromote(promote bool) *v0alpha1.Config {
	c := &v0alpha1.Config{ObjectMeta: metav1.ObjectMeta{Name: v0alpha1.ConfigSingletonName}}
	c.Spec.ExternalRulerSync = &v0alpha1.ConfigV0alpha1SpecExternalRulerSync{Promote: &promote}
	return c
}

func configWithPromotionCommittedStatus() *v0alpha1.Config {
	c := configWithPromote(true)
	c.Status.Conditions = []v0alpha1.ConfigCondition{{
		Type:   conditionTypeExternalRulerSynced,
		Reason: promotionCommittedReason,
	}}
	uid := "ds-uid"
	c.Status.ExternalRulerSync = &v0alpha1.ConfigV0alpha1StatusExternalRulerSync{DatasourceUid: &uid}
	return c
}

func TestValidateConfigWrite(t *testing.T) {
	ctx := context.Background()

	t.Run("rejects a non-singleton name", func(t *testing.T) {
		fn := ValidateConfigWrite(RuntimeConfig{})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{Object: configWithUID("not-default", "")})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "singleton")
	})

	t.Run("validates the datasource on a change to a non-empty UID", func(t *testing.T) {
		var gotUID string
		fn := ValidateConfigWrite(RuntimeConfig{
			ValidateExternalRulerSyncDatasource: func(_ context.Context, uid string) error {
				gotUID = uid
				return errors.New("boom")
			},
		})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{
			Object: configWithUID(v0alpha1.ConfigSingletonName, "ds-uid"),
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "externalRulerSync.datasourceUid")
		assert.Equal(t, "ds-uid", gotUID)
	})

	t.Run("skips validation when the UID is unchanged", func(t *testing.T) {
		called := false
		fn := ValidateConfigWrite(RuntimeConfig{
			ValidateExternalRulerSyncDatasource: func(context.Context, string) error {
				called = true
				return errors.New("should not be called")
			},
		})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{
			Object:    configWithUID(v0alpha1.ConfigSingletonName, "ds-uid"),
			OldObject: configWithUID(v0alpha1.ConfigSingletonName, "ds-uid"),
		})
		require.NoError(t, err)
		assert.False(t, called)
	})

	t.Run("clearing the UID is always allowed", func(t *testing.T) {
		called := false
		fn := ValidateConfigWrite(RuntimeConfig{
			ValidateExternalRulerSyncDatasource: func(context.Context, string) error {
				called = true
				return errors.New("should not be called")
			},
		})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{
			Object:    configWithUID(v0alpha1.ConfigSingletonName, ""),
			OldObject: configWithUID(v0alpha1.ConfigSingletonName, "ds-uid"),
		})
		require.NoError(t, err)
		assert.False(t, called)
	})

	t.Run("nil validator disables the datasource check", func(t *testing.T) {
		fn := ValidateConfigWrite(RuntimeConfig{})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{
			Object: configWithUID(v0alpha1.ConfigSingletonName, "ds-uid"),
		})
		require.NoError(t, err)
	})

	t.Run("rejects reverting promote once promotion has committed", func(t *testing.T) {
		fn := ValidateConfigWrite(RuntimeConfig{})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{
			Object:    configWithPromote(false),
			OldObject: configWithPromotionCommittedStatus(),
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "externalRulerSync.promote")
		assert.Contains(t, err.Error(), "one-way")
	})

	t.Run("allows re-affirming promote:true once promotion has committed", func(t *testing.T) {
		fn := ValidateConfigWrite(RuntimeConfig{})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{
			Object:    configWithPromote(true),
			OldObject: configWithPromotionCommittedStatus(),
		})
		require.NoError(t, err)
	})

	t.Run("allows setting promote:false when promotion never committed", func(t *testing.T) {
		fn := ValidateConfigWrite(RuntimeConfig{})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{
			Object:    configWithPromote(false),
			OldObject: configWithPromote(true), // requested, not yet committed
		})
		require.NoError(t, err)
	})

	t.Run("allows requesting promote:true for the first time", func(t *testing.T) {
		fn := ValidateConfigWrite(RuntimeConfig{})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{
			Object:    configWithPromote(true),
			OldObject: configWithUID(v0alpha1.ConfigSingletonName, "ds-uid"),
		})
		require.NoError(t, err)
	})

	t.Run("nil folder-exists callback defaults to blocking the revert (fail-safe)", func(t *testing.T) {
		fn := ValidateConfigWrite(RuntimeConfig{})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{
			Object:    configWithPromote(false),
			OldObject: configWithPromotionCommittedStatus(),
		})
		require.Error(t, err)
	})

	t.Run("blocks the revert while the canonical sync folder still exists", func(t *testing.T) {
		var gotUID string
		fn := ValidateConfigWrite(RuntimeConfig{
			ExternalRulerSyncFolderExists: func(_ context.Context, uid string) (bool, error) {
				gotUID = uid
				return true, nil
			},
		})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{
			Object:    configWithPromote(false),
			OldObject: configWithPromotionCommittedStatus(),
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "one-way")
		assert.Equal(t, "ds-uid", gotUID, "checks the status UID (last actually synced), not spec")
	})

	t.Run("allows the revert once the canonical sync folder is gone", func(t *testing.T) {
		fn := ValidateConfigWrite(RuntimeConfig{
			ExternalRulerSyncFolderExists: func(context.Context, string) (bool, error) {
				return false, nil
			},
		})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{
			Object:    configWithPromote(false),
			OldObject: configWithPromotionCommittedStatus(),
		})
		require.NoError(t, err)
	})

	t.Run("a folder-exists lookup error rejects the write instead of silently choosing either default", func(t *testing.T) {
		fn := ValidateConfigWrite(RuntimeConfig{
			ExternalRulerSyncFolderExists: func(context.Context, string) (bool, error) {
				return false, errors.New("datastore unavailable")
			},
		})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{
			Object:    configWithPromote(false),
			OldObject: configWithPromotionCommittedStatus(),
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "check sync folder")
	})

	t.Run("folder-exists callback is not consulted when promote is being re-affirmed, not reverted", func(t *testing.T) {
		called := false
		fn := ValidateConfigWrite(RuntimeConfig{
			ExternalRulerSyncFolderExists: func(context.Context, string) (bool, error) {
				called = true
				return true, nil
			},
		})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{
			Object:    configWithPromote(true),
			OldObject: configWithPromotionCommittedStatus(),
		})
		require.NoError(t, err)
		assert.False(t, called)
	})
}
