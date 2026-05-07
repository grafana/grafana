package schemaversion

import (
	"context"
)

// V5 is a no-op migration
func V5(_ context.Context, dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 5
	return nil
}
