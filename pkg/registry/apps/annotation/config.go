package annotation

import (
	"github.com/spf13/pflag"

	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/setting"
)

// Config holds the store backend configuration for the annotation app.
type Config struct {
	StoreBackend      string
	GRPCAddress       string
	GRPCUseTLS        bool
	GRPCTLSCAFile     string
	GRPCTLSSkipVerify bool

	// CleanupSettings configures annotation pruning for the SQL backend's LifecycleManager.
	// Zero value (all limits unset) disables cleanup. Not used by memory or gRPC backends.
	CleanupSettings annotations.CleanupSettings
}

func (c *Config) AddFlags(flags *pflag.FlagSet) {
	// TODO: add cleanup flags when the SQL backend is supported in MT.
	flags.StringVar(&c.StoreBackend, "annotation.store-backend", "memory", "Annotation store backend: memory, grpc")
	flags.StringVar(&c.GRPCAddress, "annotation.grpc-address", "", "gRPC server address for the annotation store")
	flags.BoolVar(&c.GRPCUseTLS, "annotation.grpc-use-tls", false, "Enable TLS for the annotation gRPC connection")
	flags.StringVar(&c.GRPCTLSCAFile, "annotation.grpc-tls-ca-file", "", "CA certificate file for the annotation gRPC connection")
	flags.BoolVar(&c.GRPCTLSSkipVerify, "annotation.grpc-tls-skip-verify", false, "Skip TLS verification for the annotation gRPC connection (insecure)")
}

func newConfigFromSettings(cfg *setting.Cfg) Config {
	return Config{
		StoreBackend:      cfg.AnnotationAppPlatform.StoreBackend,
		GRPCAddress:       cfg.AnnotationAppPlatform.GRPCAddress,
		GRPCUseTLS:        cfg.AnnotationAppPlatform.GRPCUseTLS,
		GRPCTLSCAFile:     cfg.AnnotationAppPlatform.GRPCTLSCAFile,
		GRPCTLSSkipVerify: cfg.AnnotationAppPlatform.GRPCTLSSkipVerify,
		CleanupSettings: annotations.CleanupSettings{
			Alerting:  cfg.AlertingAnnotationCleanupSetting,
			API:       cfg.APIAnnotationCleanupSettings,
			Dashboard: cfg.DashboardAnnotationCleanupSettings,
		},
	}
}
