package oauth

import (
	"fmt"

	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// ValidateCredentials performs the structural validation shared by all OAuth
// app connections: the provider section with a clientID and a clientSecret are
// required, a privateKey is forbidden. label is interpolated into error
// messages (e.g. "GitLab"); section is the spec field holding the provider
// configuration (e.g. "gitlab").
func ValidateCredentials(conn *provisioning.Connection, label, section string, cfgPresent bool, clientID string) field.ErrorList {
	var list field.ErrorList

	if !cfgPresent {
		list = append(
			list, field.Required(field.NewPath("spec", section), fmt.Sprintf("%s info must be specified in %s connection", section, label)),
		)
	} else if clientID == "" {
		list = append(list, field.Required(field.NewPath("spec", section, "clientID"), fmt.Sprintf("clientID must be specified for %s connection", label)))
	}

	if conn.Secure.ClientSecret.IsZero() {
		list = append(list, field.Required(field.NewPath("secure", "clientSecret"), fmt.Sprintf("clientSecret must be specified for %s connection", label)))
	}

	if !conn.Secure.PrivateKey.IsZero() {
		list = append(list, field.Forbidden(field.NewPath("secure", "privateKey"), fmt.Sprintf("privateKey is forbidden in %s connection", label)))
	}

	return list
}
