package pyroscope

import (
	_ "embed"
	"encoding/json"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

//go:embed profile-metrics.json
var profileMetricsJSON []byte

type ProfileMetadata struct {
	ID              string `json:"id"`
	Description     string `json:"description"`
	Type            string `json:"type"`
	Group           string `json:"group"`
	Unit            string `json:"unit"`
	AggregationType string `json:"aggregationType"`
}

type ProfileMetadataRegistry struct {
	profiles map[string]*ProfileMetadata
	mu       sync.RWMutex
	logger   log.Logger
}

var (
	registry     *ProfileMetadataRegistry
	registryOnce sync.Once
)

// GetProfileMetadataRegistry returns the singleton instance of the profile metadata registry
func GetProfileMetadataRegistry() *ProfileMetadataRegistry {
	registryOnce.Do(func() {
		registry = &ProfileMetadataRegistry{
			profiles: make(map[string]*ProfileMetadata),
			logger:   backend.NewLoggerWith("logger", "tsdb.pyroscope.profile-metadata"),
		}
		registry.loadProfileMetadata()
	})
	return registry
}

// loadProfileMetadata loads the profile metadata from the embedded JSON file
func (r *ProfileMetadataRegistry) loadProfileMetadata() {
	var profilesMap map[string]*ProfileMetadata
	err := json.Unmarshal(profileMetricsJSON, &profilesMap)
	if err != nil {
		r.logger.Error("Failed to parse embedded profile-metrics.json", "error", err)
		return
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	r.profiles = profilesMap
	r.logger.Info("Loaded profile metadata", "count", len(profilesMap))
}

// GetProfileMetadata returns the metadata for a given profile type ID
func (r *ProfileMetadataRegistry) GetProfileMetadata(profileTypeID string) *ProfileMetadata {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.profiles[profileTypeID]
}

// IsCumulativeProfile returns true if the profile type requires rate calculation
func (r *ProfileMetadataRegistry) IsCumulativeProfile(profileTypeID string) bool {
	metadata := r.GetProfileMetadata(profileTypeID)
	if metadata == nil {
		r.logger.Debug("Profile metadata not found, using fallback logic", "profileTypeID", profileTypeID)
		return isCumulativeProfileUnitFallback(getUnits(profileTypeID))
	}
	return metadata.AggregationType == "cumulative"
}

// isCumulativeProfileUnitFallback is the (old) fallback logic for unknown profile types
func isCumulativeProfileUnitFallback(unit string) bool {
	switch unit {
	case "ns":
		return true
	case "bytes":
		return true
	default:
		return false
	}
}
