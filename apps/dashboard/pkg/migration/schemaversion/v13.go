package schemaversion

import (
	"context"
)

// V13 is a no-op migration
func V13(_ context.Context, dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 13
	return nil
}
