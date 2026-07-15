package app

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
)

func configObj(name string, uid *string) *v0alpha1.Config {
	o := &v0alpha1.Config{}
	o.SetName(name)
	if uid != nil {
		o.Spec.ExternalAlertmanagerSync = &v0alpha1.ConfigV0alpha1SpecExternalAlertmanagerSync{DatasourceUid: uid}
	}
	return o
}

func ptr[T any](v T) *T { return &v }

// failIfCalled is a datasource validator that fails the test if invoked. Used
// to assert the validator is NOT reached for a given request.
func failIfCalled(t *testing.T) func(context.Context, string) error {
	return func(context.Context, string) error {
		t.Helper()
		t.Fatal("datasource validator should not have been called")
		return nil
	}
}

func TestNewConfigValidator(t *testing.T) {
	ctx := context.Background()

	t.Run("rejects non-singleton name", func(t *testing.T) {
		v := newConfigValidator(&Config{ValidateExternalSyncDatasource: failIfCalled(t)})
		err := v.ValidateFunc(ctx, &app.AdmissionRequest{Object: configObj("not-default", nil)})
		if err == nil || !strings.Contains(err.Error(), "singleton") {
			t.Fatalf("expected singleton rejection, got %v", err)
		}
	})

	t.Run("allows singleton name with no UID change", func(t *testing.T) {
		v := newConfigValidator(&Config{ValidateExternalSyncDatasource: failIfCalled(t)})
		if err := v.ValidateFunc(ctx, &app.AdmissionRequest{Object: configObj(v0alpha1.ConfigSingletonName, nil)}); err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
	})

	t.Run("runs datasource validator when UID set to non-empty", func(t *testing.T) {
		called := false
		cfg := &Config{ValidateExternalSyncDatasource: func(_ context.Context, uid string) error {
			called = true
			return fmt.Errorf("boom: %s", uid)
		}}
		err := newConfigValidator(cfg).ValidateFunc(ctx, &app.AdmissionRequest{Object: configObj(v0alpha1.ConfigSingletonName, ptr("uid-1"))})
		if !called {
			t.Fatal("expected datasource validator to be called")
		}
		if err == nil || !strings.Contains(err.Error(), "externalAlertmanagerSync.datasourceUid") {
			t.Fatalf("expected wrapped datasource error, got %v", err)
		}
	})

	t.Run("allows clearing UID without running validator", func(t *testing.T) {
		req := &app.AdmissionRequest{
			Object:    configObj(v0alpha1.ConfigSingletonName, nil),
			OldObject: configObj(v0alpha1.ConfigSingletonName, ptr("uid-1")),
		}
		if err := newConfigValidator(&Config{ValidateExternalSyncDatasource: failIfCalled(t)}).ValidateFunc(ctx, req); err != nil {
			t.Fatalf("expected no error when clearing UID, got %v", err)
		}
	})
}

func configWithTimings(t *v0alpha1.ConfigV0alpha1SpecAutogenRouteTimings) *v0alpha1.Config {
	o := &v0alpha1.Config{}
	o.SetName(v0alpha1.ConfigSingletonName)
	o.Spec.AutogenRouteTimings = t
	return o
}

func TestValidateAutogenRouteTimings(t *testing.T) {
	ctx := context.Background()
	v := newConfigValidator(&Config{ValidateExternalSyncDatasource: failIfCalled(t)})

	t.Run("absent block is valid", func(t *testing.T) {
		if err := v.ValidateFunc(ctx, &app.AdmissionRequest{Object: configWithTimings(nil)}); err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
	})

	t.Run("empty block is valid", func(t *testing.T) {
		if err := v.ValidateFunc(ctx, &app.AdmissionRequest{Object: configWithTimings(&v0alpha1.ConfigV0alpha1SpecAutogenRouteTimings{})}); err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
	})

	t.Run("empty-string values are treated as unset", func(t *testing.T) {
		obj := configWithTimings(&v0alpha1.ConfigV0alpha1SpecAutogenRouteTimings{GroupWait: ptr(""), GroupInterval: ptr(""), RepeatInterval: ptr("")})
		if err := v.ValidateFunc(ctx, &app.AdmissionRequest{Object: obj}); err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
	})

	t.Run("valid Prometheus durations are accepted", func(t *testing.T) {
		obj := configWithTimings(&v0alpha1.ConfigV0alpha1SpecAutogenRouteTimings{GroupWait: ptr("30s"), GroupInterval: ptr("5m"), RepeatInterval: ptr("4h")})
		if err := v.ValidateFunc(ctx, &app.AdmissionRequest{Object: obj}); err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
	})

	t.Run("rejects unparseable duration", func(t *testing.T) {
		for _, tc := range []struct {
			name    string
			timings *v0alpha1.ConfigV0alpha1SpecAutogenRouteTimings
			field   string
		}{
			{"group_wait", &v0alpha1.ConfigV0alpha1SpecAutogenRouteTimings{GroupWait: ptr("nope")}, "group_wait"},
			{"group_interval", &v0alpha1.ConfigV0alpha1SpecAutogenRouteTimings{GroupInterval: ptr("5")}, "group_interval"},
			{"repeat_interval", &v0alpha1.ConfigV0alpha1SpecAutogenRouteTimings{RepeatInterval: ptr("1 hour")}, "repeat_interval"},
		} {
			t.Run(tc.name, func(t *testing.T) {
				err := v.ValidateFunc(ctx, &app.AdmissionRequest{Object: configWithTimings(tc.timings)})
				if err == nil || !strings.Contains(err.Error(), "autogenRouteTimings."+tc.field) {
					t.Fatalf("expected %s duration rejection, got %v", tc.field, err)
				}
			})
		}
	})
}

type stubReceiverTestingHandler struct{}

func (stubReceiverTestingHandler) HandleReceiverTestingRequest(context.Context, app.CustomRouteResponseWriter, *app.CustomRouteRequest) error {
	return nil
}

type stubSchemaHandler struct{}

func (stubSchemaHandler) HandleGetSchemas(context.Context, app.CustomRouteResponseWriter, *app.CustomRouteRequest) error {
	return nil
}

func TestConfigValidate_RequiresExternalSyncValidator(t *testing.T) {
	cfg := &Config{
		ReceiverTestingHandler:       stubReceiverTestingHandler{},
		IntegrationTypeSchemaHandler: stubSchemaHandler{},
	}
	if err := cfg.Validate(); err == nil || !strings.Contains(err.Error(), "external sync datasource validator") {
		t.Fatalf("expected required-validator error, got %v", err)
	}

	cfg.ValidateExternalSyncDatasource = func(context.Context, string) error { return nil }
	if err := cfg.Validate(); err != nil {
		t.Fatalf("expected valid config, got %v", err)
	}
}
