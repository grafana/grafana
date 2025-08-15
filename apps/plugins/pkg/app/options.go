package app

import (
	"fmt"

	"github.com/spf13/pflag"
	genericapiserver "k8s.io/apiserver/pkg/server"
)

func NewOptions() *Options {
	return &Options{
		InstallSource: InstallSourceTypeDisk,
	}
}

type InstallSourceType string

const (
	InstallSourceTypeDisk InstallSourceType = "disk"
	InstallSourceTypeAPI  InstallSourceType = "api"
)

func (i InstallSourceType) String() string {
	return string(i)
}

func (i InstallSourceType) Set(value string) error {
	switch value {
	case "disk":
		i = InstallSourceTypeDisk
	case "api":
		i = InstallSourceTypeAPI
	default:
		return fmt.Errorf("invalid install source type: %s", value)
	}
	return nil
}

func (i InstallSourceType) Type() string {
	return "InstallSourceType"
}

// Options are the user configurable options for the plugins app.
type Options struct {
	InstallSource InstallSourceType
}

func (o *Options) AddFlags(fs *pflag.FlagSet) {
	fs.Var(&o.InstallSource, "grafana.plugins.install-source", "Source for plugin installations. Options: disk, api")
}

func (o *Options) ApplyTo(config *genericapiserver.RecommendedConfig) error {
	return nil
}

func (o *Options) Validate() []error {
	var errs []error
	if o.InstallSource != InstallSourceTypeDisk && o.InstallSource != InstallSourceTypeAPI {
		errs = append(errs, fmt.Errorf("invalid install source type: %s", o.InstallSource))
	}
	return errs
}
