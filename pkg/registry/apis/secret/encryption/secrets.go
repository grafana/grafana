package encryption

import (
	"fmt"
	"strings"
	"time"
)

const UsageInsightsPrefix = "secrets_manager"

type ProviderID string

func (id ProviderID) Kind() (string, error) {
	idStr := string(id)

	parts := strings.SplitN(idStr, ".", 2)
	if len(parts) != 2 {
		return "", fmt.Errorf("malformatted provider identifier %s: expected format <provider>.<keyName>", idStr)
	}

	return parts[0], nil
}

func KeyLabel(providerID ProviderID) string {
	return fmt.Sprintf("%s@%s", time.Now().Format("2006-01-02"), providerID)
}
