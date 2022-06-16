package kmsproviders

import "github.com/grafana/grafana/pkg/services/secrets"

const (
	// Legacy is used for historical reasons (keeping backwards).
	// In older versions, the default value was a non-valid identifier,
	// so it was updated to a valid one. See Default.
	Legacy = "secretKey"

	// Default is the identifier of the default kms provider
	// which fallbacks to Grafana's secret key. See the
	// defaultprovider package for further information.
	Default = "secretKey.v1"
)

type Service interface {
	Provide() (map[secrets.ProviderID]secrets.Provider, error)
}

func NormalizeProviderID(id secrets.ProviderID) secrets.ProviderID {
	if id == Legacy {
		return Default
	}

	return id
}
