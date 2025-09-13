package good

import (
	"fmt"
	"time"
)

// Config represents application configuration
type Config struct {
	Port    int
	Host    string
	Timeout time.Duration
	Debug   bool
}

// NewConfig creates a new configuration instance
func NewConfig(port int, host string, timeout time.Duration, debug bool) *Config {
	return &Config{
		Port:    port,
		Host:    host,
		Timeout: timeout,
		Debug:   debug,
	}
}

// Repository represents a data repository
type Repository struct {
	config *Config
}

// NewRepository creates a new repository instance
func NewRepository(config *Config) *Repository {
	return &Repository{config: config}
}

// Service represents a business service
type Service struct {
	config     *Config
	repository *Repository
}

// NewService creates a new service instance
func NewService(config *Config, repository *Repository) *Service {
	return &Service{
		config:     config,
		repository: repository,
	}
}

// Application represents the main application
type Application struct {
	config  *Config
	service *Service
}

// NewApplication creates a new application instance
func NewApplication(config *Config, service *Service) *Application {
	return &Application{
		config:  config,
		service: service,
	}
}

// Run starts the application
func (app *Application) Run() error {
	fmt.Printf("Starting application on %s:%d\n", app.config.Host, app.config.Port)
	fmt.Printf("Timeout: %v, Debug: %v\n", app.config.Timeout, app.config.Debug)
	return nil
}

// ProvideConfig creates a configuration instance
// This function does NOT call methods on dependencies - should NOT be detected
func ProvideConfig() *Config {
	return NewConfig(8080, "localhost", 30*time.Second, true)
}

// ProvideRepository creates a repository instance
// This function does NOT call methods on dependencies - should NOT be detected
func ProvideRepository(config *Config) *Repository {
	return NewRepository(config)
}

// ProvideService creates a service instance
// This function does NOT call methods on dependencies - should NOT be detected
func ProvideService(config *Config, repository *Repository) *Service {
	return NewService(config, repository)
}

// ProvideApplication creates an application instance
// This function does NOT call methods on dependencies - should NOT be detected
func ProvideApplication(config *Config, service *Service) *Application {
	return NewApplication(config, service)
}
