package conversion

import (
	"context"

	"github.com/grafana/grafana/pkg/services/librarypanels"
)

const libraryPanelServiceKey contextKey = "libraryPanelService"

// WithLibraryPanelService adds the library panel service to the context
// This is the same service instance initialized in register.go
func WithLibraryPanelService(ctx context.Context, service librarypanels.Service) context.Context {
	return context.WithValue(ctx, libraryPanelServiceKey, service)
}

// getLibraryPanelService returns the library panel service from context
// Matches the migration pattern where service is always available (captured in closure)
// The service should be set in context by prepareV2alpha1ConversionContext
func getLibraryPanelService(ctx context.Context) librarypanels.Service {
	// Get service from context (set by prepareV2alpha1ConversionContext)
	// This matches migrations where service is captured in closure
	if service, ok := ctx.Value(libraryPanelServiceKey).(librarypanels.Service); ok {
		return service
	}

	// Fallback to package-level service (set in register.go or tests)
	if libraryPanelService != nil {
		return libraryPanelService
	}

	return nil
}

// libraryPanelService is a package-level variable that holds the library panel service
// It's set during initialization in register.go and used as a fallback when context doesn't have the service
var libraryPanelService librarypanels.Service

// SetLibraryPanelService sets the library panel service for use in conversions
// This is called during initialization in register.go
func SetLibraryPanelService(service librarypanels.Service) {
	libraryPanelService = service
}

// GetLibraryPanelService returns the library panel service instance
// This allows the service to be added to context during conversion preparation
func GetLibraryPanelService() librarypanels.Service {
	return libraryPanelService
}
