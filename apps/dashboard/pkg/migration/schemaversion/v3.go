package schemaversion

import "context"

// V3 is a no-op migration
func V3(_ context.Context, dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 3
	return nil
}
