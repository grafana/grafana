package util

import (
	"os"
)

func GetGrafanaImage() string {
	if image := os.Getenv("GRAFANA_IMAGE"); image != "" {
		return image
	}

	panic("Provide GRAFANA_IMAGE")
}
