package v0alpha1

import "encoding/json"

// UnmarshalJSON temporarily accepts legacy string requirements so existing policies
// can be reset. Remove this compatibility layer once those policies are cleared.
func (r *FieldRequirement) UnmarshalJSON(data []byte) error {
	if len(data) > 0 && data[0] == '"' {
		var key string
		if err := json.Unmarshal(data, &key); err != nil {
			return err
		}

		// Legacy requirements always blocked non-compliant alert rule writes.
		*r = FieldRequirement{Key: key, Enforce: true}
		return nil
	}

	type fieldRequirement FieldRequirement
	return json.Unmarshal(data, (*fieldRequirement)(r))
}
