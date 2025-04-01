package alertmanager

import (
	"os"

	"github.com/grafana/e2e"
)

const (
	defaultPostgresImage = "postgres:16.4"
	postgresHTTPPort     = 5432
)

// GetDefaultImage returns the Docker image to use to run the Postgres..
func GetPostgresImage() string {
	if img := os.Getenv("POSTGRES_IMAGE"); img != "" {
		return img
	}

	return defaultPostgresImage
}

type PostgresService struct {
	*e2e.HTTPService
}

func NewPostgresService(name string, envVars map[string]string) *PostgresService {
	svc := &PostgresService{
		HTTPService: e2e.NewHTTPService(
			name,
			GetPostgresImage(),
			nil,
			nil,
			postgresHTTPPort,
		),
	}

	svc.SetEnvVars(envVars)

	return svc
}
