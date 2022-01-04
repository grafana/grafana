package kmsproviders

import "github.com/grafana/grafana/pkg/services/secrets"

const (
	Default = "secretKey.v1"
)

type Service interface {
	Provide() (map[secrets.ProviderID]secrets.Provider, error)
}
