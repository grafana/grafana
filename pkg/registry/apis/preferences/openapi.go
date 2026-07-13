package preferences

import (
	"k8s.io/kube-openapi/pkg/spec3"
)

func (b *APIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	oas.Info.Description = "Configure user, team, and org preferences"
	return oas, nil
}
