package common

import (
	"fmt"
	"strconv"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
)

// GetContinueID is a helper to parse options.Continue as int64.
// If no continue token is provided 0 is returned.
func GetContinueID(options *internalversion.ListOptions) (int64, error) {
	if options.Continue != "" {
		continueID, err := strconv.ParseInt(options.Continue, 10, 64)
		if err != nil {
			return 0, fmt.Errorf("invalid continue token: %w", err)
		}
		return continueID, nil
	}
	return 0, nil
}

// OptonalFormatInt formats num as a string. If num is less or equal than 0
// an empty string is returned.
func OptionalFormatInt(num int64) string {
	if num > 0 {
		return strconv.FormatInt(num, 10)
	}
	return ""
}
