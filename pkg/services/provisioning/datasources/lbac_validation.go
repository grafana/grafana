package datasources

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/datasources"
)

func validateNoLBACRules(fileConfig *configs) error {
	field := "jsonData.teamHttpHeaders"
	if fileConfig.APIVersion == 0 {
		field = "json_data.teamHttpHeaders"
	}
	for _, ds := range fileConfig.Datasources {
		if ds == nil {
			continue
		}
		headers, err := datasources.GetTeamHTTPHeaders(simplejson.NewFromAny(ds.JSONData))
		if err != nil {
			return fmt.Errorf("datasource %q: %s has an invalid structure", ds.Name, field)
		}
		if headers == nil {
			continue
		}
		for _, entries := range headers.Headers {
			for _, entry := range entries {
				if strings.EqualFold(entry.Header, "X-Prom-Label-Policy") {
					return fmt.Errorf("datasource %q: LBAC rules in %s are not supported by file provisioning; use Terraform to provision LBAC-enabled datasources", ds.Name, field)
				}
			}
		}
	}
	return nil
}
