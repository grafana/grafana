package setting

import (
	"encoding/json"
	"fmt"
)

// QuickRanges is a slice of QuickRange objects that can be directly used in frontend
type QuickRanges []QuickRange

// QuickRange represents a time range option in the time picker.
// It defines a preset time range that users can select from the time picker dropdown.
type QuickRange struct {
	// Display is the user-friendly label shown in the UI for this time range
	Display string `json:"display"`
	// From is the start of the time range in a format like "now-6h" or an absolute time
	From string `json:"from"`
	// To is the end of the time range, defaults to "now" if omitted
	To string `json:"to,omitempty"`
}

func (cfg *Cfg) readTimePicker() error {
	timePickerSection := cfg.Raw.Section("time_picker")
	quickRangesStr := timePickerSection.Key("quick_ranges").String()

	if quickRangesStr == "" {
		cfg.QuickRanges = []QuickRange{}
		return nil
	}

	var quickRanges []QuickRange
	err := json.Unmarshal([]byte(quickRangesStr), &quickRanges)
	if err != nil {
		cfg.Logger.Error("Failed to parse quick_ranges", "error", err)
		return fmt.Errorf("failed to parse quick_ranges: %w", err)
	}

	// Validate the quick ranges and set defaults
	for i, qr := range quickRanges {
		if qr.Display == "" {
			cfg.Logger.Error("Quick range is missing display name", "index", i)
			return fmt.Errorf("quick range at index %d is missing display name", i)
		}
		if qr.From == "" {
			cfg.Logger.Error("Quick range is missing 'from' field", "display", qr.Display)
			return fmt.Errorf("quick range '%s' is missing 'from' field", qr.Display)
		}
		// Set default value for To field if it's empty
		if qr.To == "" {
			quickRanges[i].To = "now"
		}
	}

	cfg.QuickRanges = quickRanges

	return nil
}
