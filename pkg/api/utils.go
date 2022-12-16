package api

import (
	"encoding/json"
	"net/mail"

	"github.com/grafana/grafana/pkg/api/dtos"
)

func jsonMap(data []byte) (map[string]string, error) {
	jsonMap := make(map[string]string)
	err := json.Unmarshal(data, &jsonMap)
	return jsonMap, err
}

func ValidateAndNormalizeEmail(email string) (string, error) {
	if email == "" {
		return "", nil
	}

	e, err := mail.ParseAddress(email)
	if err != nil {
		return "", err
	}

	return e.Address, nil
}

func GetDefaultNavUrl(listItem dtos.PluginListItem, isDataConnectionsConsoleEnabled bool, appSubURL string) string {
	if listItem.Type == "datasource" && isDataConnectionsConsoleEnabled {
		return appSubURL + "/connections/connect-data/datasources/" + listItem.Id + "/"
	} else {
		return appSubURL + "/plugins/" + listItem.Id + "/"
	}
}
