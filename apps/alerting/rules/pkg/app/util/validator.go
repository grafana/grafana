package util

import (
	"fmt"
	"time"
)

type DurationLike interface {
	ToDuration() (time.Duration, error)
}

func ValidateInterval(baseInterval time.Duration, d DurationLike) error {
	interval, err := d.ToDuration()
	if err != nil {
		return fmt.Errorf("invalid trigger interval: %w", err)
	}
	// Ensure interval is positive and an integer multiple of BaseEvaluationInterval (if provided)
	if interval <= 0 {
		return fmt.Errorf("trigger interval must be greater than 0")
	}
	if baseInterval > 0 {
		if (interval % baseInterval) != 0 {
			return fmt.Errorf("trigger interval must be a multiple of base evaluation interval (%s)", baseInterval.String())
		}
	}
	return nil
}
