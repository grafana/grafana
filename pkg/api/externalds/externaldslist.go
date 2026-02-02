// bmc code -  ExternalDataSources holds list of datasources stored in custom.ini(should match with datasource id in plugin.json) that need masking, port check etc.
package externalds

import "github.com/grafana/grafana/pkg/setting"


func IsExternalDs(dsType string) bool {
	for _, ds := range setting.ExternalDsList {
		if ds == dsType {
			return true
		}
	}
	return false
}

//masked url for non super admin for external datasources
const MaskedUrl = "********"
