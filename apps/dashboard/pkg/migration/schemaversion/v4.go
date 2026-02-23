package schemaversion

import "context"

// V4 is a no-op migration
func V4(_ context.Context, dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 4
	return nil
}
