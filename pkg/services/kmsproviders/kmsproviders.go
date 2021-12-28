package kmsproviders

import "github.com/grafana/grafana/pkg/services/secrets"

const (
	Default = "secretKey"
)

type Service interface {
	Provide() (map[string]secrets.Provider, error)
}
