package app

import (
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/util/validation"
)

// ErrInvalidMachineLabel is returned when a Network's machineLabel is not a
// valid DNS-1123 label.
var ErrInvalidMachineLabel = fmt.Errorf("invalid machine label")

// validateMachineLabel checks that machineLabel is safe to use as the
// machine-name segment of a tailnet hostname
// (grafanacloud-<stackID>-tailscale-<machineLabel>).
func validateMachineLabel(label string) error {
	if errs := validation.IsDNS1123Label(label); len(errs) > 0 {
		return fmt.Errorf("%w: %s", ErrInvalidMachineLabel, strings.Join(errs, ", "))
	}
	return nil
}
