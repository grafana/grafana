package e2e

import (
	"context"
	"fmt"
	"strings"

	"dagger.io/dagger"
)

// validateLicense uses the given container and license path to validate the license for each edition (enterprise or oss)
func ValidateLicense(ctx context.Context, service *dagger.Container, licensePath string, enterprise bool) error {
	license, err := service.File(licensePath).Contents(ctx)
	if err != nil {
		return err
	}

	if enterprise {
		if !strings.Contains(license, "Grafana Enterprise") {
			return fmt.Errorf("license in package is not the Grafana Enterprise license agreement")
		}

		return nil
	}

	if !strings.Contains(license, "GNU AFFERO GENERAL PUBLIC LICENSE") {
		return fmt.Errorf("license in package is not the Grafana open-source license agreement")
	}

	return nil
}
