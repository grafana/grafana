package test

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
)

// Define the types for easier initialization
type LabelFields struct {
	Environment string `json:"environment"`
	App         string `json:"app"`
}

type MetadataFields struct {
	Name       string      `json:"name"`
	Namespace  string      `json:"namespace"`
	Generation int         `json:"generation"`
	Labels     LabelFields `json:"labels"`
}

type SpecFields struct {
	Description string   `json:"description"`
	Tags        []string `json:"tags"`
}

type resourceWithFields struct {
	Metadata MetadataFields `json:"metadata"`
	Spec     SpecFields     `json:"spec"`
}

// Helper function to extract resources from a list iterator
func extractResources(iter resource.ListIterator) ([]*resource.ResourceWrapper, error) {
	var items []*resource.ResourceWrapper
	for iter.Next() {
		items = append(items, &resource.ResourceWrapper{
			ResourceVersion: iter.ResourceVersion(),
			Value:           iter.Value(),
		})
	}
	return items, iter.Error()
}

// Helper function to extract names from resource wrappers
func extractNames(items []*resource.ResourceWrapper) ([]string, error) {
	names := make([]string, 0, len(items))
	for _, item := range items {
		var res resourceWithFields
		if err := json.Unmarshal(item.Value, &res); err != nil {
			return nil, err
		}
		names = append(names, res.Metadata.Name)
	}
	return names, nil
}

// TestTemplateJsonExtract tests the JsonExtract functionality in SQL templates
// against actual database instances to ensure it works correctly with
// different operators and database dialects.
func TestTemplateJsonExtract(t *testing.T) {
	// Skip in short mode since this is an integration test
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Set up test resources
	testResources := []resourceWithFields{
		{
			Metadata: MetadataFields{
				Name:       "dashboard-1",
				Namespace:  "default",
				Generation: 3,
				Labels: LabelFields{
					Environment: "prod",
					App:         "monitoring",
				},
			},
			Spec: SpecFields{
				Description: "Production dashboard",
				Tags:        []string{"production", "metrics"},
			},
		},
		{
			Metadata: MetadataFields{
				Name:       "dashboard-2",
				Namespace:  "dev",
				Generation: 1,
				Labels: LabelFields{
					Environment: "dev",
					App:         "monitoring",
				},
			},
			Spec: SpecFields{
				Description: "Development dashboard",
				Tags:        []string{"development", "metrics"},
			},
		},
		{
			Metadata: MetadataFields{
				Name:       "dashboard-3",
				Namespace:  "test",
				Generation: 5,
				Labels: LabelFields{
					Environment: "test",
					App:         "logging",
				},
			},
			Spec: SpecFields{
				Description: "Test dashboard",
				Tags:        []string{"test", "logging"},
			},
		},
	}

	// Initialize the test database and backend
	ctx := context.Background()
	dbstore := infraDB.InitTestDB(t)
	sqlDB, err := dbimpl.ProvideResourceDB(dbstore, setting.NewCfg(), nil)
	require.NoError(t, err)
	require.NotNil(t, sqlDB)

	// Create a new SQL backend
	backend, err := sql.NewBackend(sql.BackendOptions{
		DBProvider: sqlDB,
	})
	require.NoError(t, err)
	require.NotNil(t, backend)
	err = backend.Init(ctx)
	require.NoError(t, err)

	// Insert test resources
	testGroup := "test.grafana.com"
	testResource := "testdashboards"

	// Add resources to the database
	for i, res := range testResources {
		value, err := json.Marshal(res)
		require.NoError(t, err)

		key := &resource.ResourceKey{
			Group:     testGroup,
			Resource:  testResource,
			Namespace: res.Metadata.Namespace,
			Name:      res.Metadata.Name,
		}

		event := resource.WriteEvent{
			Type:  resource.WatchEvent_ADDED,
			Key:   key,
			Value: value,
		}

		_, err = backend.WriteEvent(ctx, event)
		require.NoError(t, err, "Failed to write test resource %d", i)
	}

	// Define test cases
	testCases := []struct {
		name      string
		options   *resource.ListOptions
		wantCount int
		wantNames []string
	}{
		{
			name: "match by namespace equals",
			options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Group:    testGroup,
					Resource: testResource,
				},
				Fields: []*resource.Requirement{
					{
						Key:      "metadata.namespace",
						Operator: "=",
						Values:   []string{"dev"},
					},
				},
			},
			wantCount: 1,
			wantNames: []string{"dashboard-2"},
		},
		{
			name: "match by namespace not equals",
			options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Group:    testGroup,
					Resource: testResource,
				},
				Fields: []*resource.Requirement{
					{
						Key:      "metadata.namespace",
						Operator: "!=",
						Values:   []string{"dev"},
					},
				},
			},
			wantCount: 2,
			wantNames: []string{"dashboard-1", "dashboard-3"},
		},
		{
			name: "match generation equals",
			options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Group:    testGroup,
					Resource: testResource,
				},
				Fields: []*resource.Requirement{
					{
						Key:      "metadata.generation",
						Operator: "=",
						Values:   []string{"3"},
					},
				},
			},
			wantCount: 1,
			wantNames: []string{"dashboard-1"},
		},
		{
			name: "match spec description equals",
			options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Group:    testGroup,
					Resource: testResource,
				},
				Fields: []*resource.Requirement{
					{
						Key:      "spec.description",
						Operator: "=",
						Values:   []string{"Test dashboard"},
					},
				},
			},
			wantCount: 1,
			wantNames: []string{"dashboard-3"},
		},
		{
			name: "match multiple fields",
			options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Group:     testGroup,
					Resource:  testResource,
					Namespace: "default",
				},
				Fields: []*resource.Requirement{
					{
						Key:      "metadata.name",
						Operator: "=",
						Values:   []string{"dashboard-1"},
					},
					{
						Key:      "spec.description",
						Operator: "=",
						Values:   []string{"Production dashboard"},
					},
				},
			},
			wantCount: 1,
			wantNames: []string{"dashboard-1"},
		},
	}

	// Run the tests
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := &resource.ListRequest{
				Options: tc.options,
			}

			// List resources using the iterator
			var items []*resource.ResourceWrapper

			rv, err := backend.ListIterator(ctx, req, func(iter resource.ListIterator) error {
				var err error
				items, err = extractResources(iter)
				return err
			})
			require.NoError(t, err, "Failed to list resources")
			require.Greater(t, rv, int64(0), "Expected a valid resource version")

			// Verify count
			require.Equal(t, tc.wantCount, len(items), "Expected %d items, got %d", tc.wantCount, len(items))

			// Extract resource names for verification
			names, err := extractNames(items)
			require.NoError(t, err)

			// Verify names against expected results
			for _, wantName := range tc.wantNames {
				require.Contains(t, names, wantName, "Expected result to contain '%s'", wantName)
			}
			require.Equal(t, tc.wantCount, len(names), "Expected exactly %d results", tc.wantCount)
		})
	}
}

// TestHistoryListTemplateWithJsonExtract tests JsonExtract in the resource history list template
func TestHistoryListTemplateWithJsonExtract(t *testing.T) {
	// Skip in short mode since this is an integration test
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Set up test resources (similar to above)
	testResources := []resourceWithFields{
		{
			Metadata: MetadataFields{
				Name:       "history-1",
				Namespace:  "default",
				Generation: 2,
				Labels: LabelFields{
					Environment: "prod",
					App:         "monitoring",
				},
			},
			Spec: SpecFields{
				Description: "Production history",
				Tags:        []string{"production", "metrics"},
			},
		},
		{
			Metadata: MetadataFields{
				Name:       "history-2",
				Namespace:  "dev",
				Generation: 1,
				Labels: LabelFields{
					Environment: "dev",
					App:         "monitoring",
				},
			},
			Spec: SpecFields{
				Description: "Development history",
				Tags:        []string{"development", "metrics"},
			},
		},
	}

	// Initialize the database and backend
	ctx := context.Background()
	dbstore := infraDB.InitTestDB(t)
	sqlDB, err := dbimpl.ProvideResourceDB(dbstore, setting.NewCfg(), nil)
	require.NoError(t, err)
	require.NotNil(t, sqlDB)

	// Create a new SQL backend
	backend, err := sql.NewBackend(sql.BackendOptions{
		DBProvider: sqlDB,
	})
	require.NoError(t, err)
	require.NotNil(t, backend)
	err = backend.Init(ctx)
	require.NoError(t, err)

	// Insert test resources
	testGroup := "test.grafana.com"
	testResource := "testhistories"
	originalVersions := make(map[string]int64)

	// First version - original resources
	for i, res := range testResources {
		value, err := json.Marshal(res)
		require.NoError(t, err)

		key := &resource.ResourceKey{
			Group:     testGroup,
			Resource:  testResource,
			Namespace: res.Metadata.Namespace,
			Name:      res.Metadata.Name,
		}

		event := resource.WriteEvent{
			Type:  resource.WatchEvent_ADDED,
			Key:   key,
			Value: value,
		}

		rv, err := backend.WriteEvent(ctx, event)
		require.NoError(t, err, "Failed to write test resource %d", i)
		originalVersions[res.Metadata.Name] = rv
	}

	// Wait a bit to ensure different timestamps
	time.Sleep(100 * time.Millisecond)

	// Get the latest resource version (as cutoff for historical queries)
	listReq := &resource.ListRequest{
		Options: &resource.ListOptions{
			Key: &resource.ResourceKey{
				Group:    testGroup,
				Resource: testResource,
			},
		},
	}

	var items []*resource.ResourceWrapper
	var currentRV int64

	rv, err := backend.ListIterator(ctx, listReq, func(iter resource.ListIterator) error {
		var err error
		items, err = extractResources(iter)
		return err
	})
	require.NoError(t, err)
	currentRV = rv

	// Find the highest resource version
	for _, item := range items {
		if item.ResourceVersion > currentRV {
			currentRV = item.ResourceVersion
		}
	}

	// Second version - update resources
	for i, res := range testResources {
		// Modify resources
		res.Spec.Description = fmt.Sprintf("Updated %s", res.Spec.Description)

		value, err := json.Marshal(res)
		require.NoError(t, err)

		key := &resource.ResourceKey{
			Group:     testGroup,
			Resource:  testResource,
			Namespace: res.Metadata.Namespace,
			Name:      res.Metadata.Name,
		}

		event := resource.WriteEvent{
			Type:  resource.WatchEvent_MODIFIED,
			Key:   key,
			Value: value,
		}

		_, err = backend.WriteEvent(ctx, event)
		require.NoError(t, err, "Failed to update test resource %d", i)
	}

	// Helper function to convert string to int for generation comparisons
	parseGeneration := func(value string) int {
		gen, _ := strconv.Atoi(value)
		return gen
	}

	// Define test cases for history
	testCases := []struct {
		name            string
		resourceVersion int64
		options         *resource.ListOptions
		wantCount       int
		wantNames       []string
	}{
		{
			name:            "match by namespace equals",
			resourceVersion: currentRV,
			options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Group:    testGroup,
					Resource: testResource,
				},
				Fields: []*resource.Requirement{
					{
						Key:      "metadata.namespace",
						Operator: "=",
						Values:   []string{"default"},
					},
				},
			},
			wantCount: 1,
			wantNames: []string{"history-1"},
		},
		{
			name:            "match generation equals",
			resourceVersion: currentRV,
			options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Group:    testGroup,
					Resource: testResource,
				},
				Fields: []*resource.Requirement{
					{
						Key:      "metadata.generation",
						Operator: "=",
						Values:   []string{"2"},
					},
				},
			},
			wantCount: 1,
			wantNames: []string{"history-1"},
		},
		{
			name:            "match spec description equals",
			resourceVersion: 0, // latest
			options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Group:    testGroup,
					Resource: testResource,
				},
				Fields: []*resource.Requirement{
					{
						Key:      "spec.description",
						Operator: "=",
						Values:   []string{"Updated Production history"},
					},
				},
			},
			wantCount: 1,
			wantNames: []string{"history-1"},
		},
		{
			name:            "match by multiple conditions",
			resourceVersion: 0, // latest
			options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Group:    testGroup,
					Resource: testResource,
				},
				Fields: []*resource.Requirement{
					{
						Key:      "metadata.name",
						Operator: "=",
						Values:   []string{"history-2"},
					},
					{
						Key:      "metadata.generation",
						Operator: "=",
						Values:   []string{"1"},
					},
				},
			},
			wantCount: 1,
			wantNames: []string{"history-2"},
		},
	}

	// Run the tests
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			var items []*resource.ResourceWrapper

			// Handle current or historical versions
			listReq := &resource.ListRequest{
				ResourceVersion: tc.resourceVersion,
				Options:         tc.options,
			}

			// For history queries, we need to use a different approach
			if tc.resourceVersion > 0 {
				// Need to make individual read requests to validate history records
				// Use list to find the keys, then read their history directly
				keys := getKeysForGroup(t, ctx, backend, tc.options.Key)

				for _, key := range keys {
					// Read the historical version
					readReq := &resource.ReadRequest{
						Key:             key,
						ResourceVersion: tc.resourceVersion,
					}

					resp := backend.ReadResource(ctx, readReq)
					if resp.Error != nil || resp.Value == nil {
						continue
					}

					// Check if it matches the field criteria
					if meetsFieldRequirements(t, resp.Value, tc.options.Fields, parseGeneration) {
						items = append(items, &resource.ResourceWrapper{
							ResourceVersion: resp.ResourceVersion,
							Value:           resp.Value,
						})
					}
				}
			} else {
				// List current versions normally
				rv, err := backend.ListIterator(ctx, listReq, func(iter resource.ListIterator) error {
					var err error
					items, err = extractResources(iter)
					return err
				})
				require.NoError(t, err, "Failed to list resources")
				require.Greater(t, rv, int64(0), "Expected a valid resource version")
			}

			// Verify count
			require.Equal(t, tc.wantCount, len(items), "Expected %d items, got %d", tc.wantCount, len(items))

			// Extract names and verify
			names, err := extractNames(items)
			require.NoError(t, err)

			// Verify names against expected results
			for _, wantName := range tc.wantNames {
				require.Contains(t, names, wantName, "Expected result to contain '%s'", wantName)
			}
			require.Equal(t, tc.wantCount, len(names), "Expected exactly %d results", tc.wantCount)
		})
	}
}

// Helper function to get keys for a group/resource
func getKeysForGroup(t *testing.T, ctx context.Context, backend resource.StorageBackend,
	keyPattern *resource.ResourceKey) []*resource.ResourceKey {
	keys := make([]*resource.ResourceKey, 0)
	listReq := &resource.ListRequest{
		Options: &resource.ListOptions{
			Key: keyPattern,
		},
	}

	rv, err := backend.ListIterator(ctx, listReq, func(iter resource.ListIterator) error {
		for iter.Next() {
			var res resourceWithFields
			err := json.Unmarshal(iter.Value(), &res)
			if err != nil {
				return err
			}

			keys = append(keys, &resource.ResourceKey{
				Group:     keyPattern.Group,
				Resource:  keyPattern.Resource,
				Namespace: res.Metadata.Namespace,
				Name:      res.Metadata.Name,
			})
		}
		return iter.Error()
	})

	require.NoError(t, err)
	require.Greater(t, rv, int64(0), "Expected a valid resource version")
	return keys
}

// Helper function to check if a resource meets field requirements
func meetsFieldRequirements(t *testing.T, value []byte, requirements []*resource.Requirement,
	parseGenerationFn func(string) int) bool {
	if len(requirements) == 0 {
		return true
	}

	var res resourceWithFields
	err := json.Unmarshal(value, &res)
	require.NoError(t, err)

	for _, req := range requirements {
		// Namespace field
		if req.Key == "metadata.namespace" {
			nsValue := res.Metadata.Namespace
			if (req.Operator == "=" && nsValue != req.Values[0]) ||
				(req.Operator == "!=" && nsValue == req.Values[0]) {
				return false
			}
		}
		// Name field
		if req.Key == "metadata.name" {
			nameValue := res.Metadata.Name
			if (req.Operator == "=" && nameValue != req.Values[0]) ||
				(req.Operator == "!=" && nameValue == req.Values[0]) {
				return false
			}
		}
		// Generation field
		if req.Key == "metadata.generation" {
			genValue := res.Metadata.Generation
			reqGenValue := parseGenerationFn(req.Values[0])

			if (req.Operator == "=" && genValue != reqGenValue) ||
				(req.Operator == "!=" && genValue == reqGenValue) {
				return false
			}
		}
		// Description field
		if req.Key == "spec.description" {
			descValue := res.Spec.Description
			if (req.Operator == "=" && descValue != req.Values[0]) ||
				(req.Operator == "!=" && descValue == req.Values[0]) {
				return false
			}
		}
	}

	return true
}
