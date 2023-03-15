package telemetryexport

import "errors"

type OtlpHttpExporterConfig struct {
	Insecure bool     `ini:"insecure"`
	Endpoint string   `ini:"endpoint"`
	Headers  []string `ini:"headers"`
}

func (c OtlpHttpExporterConfig) Validate() error {
	if c.Endpoint == "" {
		return errors.New("endpoint is required")
	}

	return nil
}
