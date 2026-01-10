package sims

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
)

func TestNBodyQuery(t *testing.T) {
	s, err := NewSimulationEngine()
	require.NoError(t, err)

	t.Run("simple nbody simulation", func(t *testing.T) {
		sq := &simulationQuery{}
		sq.Key = simulationKey{
			Type:   "nbody",
			TickHZ: 10,
		}
		sq.Config = map[string]any{
			"n":      5,
			"width":  400.0,
			"height": 300.0,
			"seed":   42,
		}

		sb, err := json.Marshal(map[string]any{
			"sim": sq,
		})
		require.NoError(t, err)

		start := time.Date(2020, time.January, 10, 23, 0, 0, 0, time.UTC)
		qr := &backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{
					RefID: "A",
					TimeRange: backend.TimeRange{
						From: start,
						To:   start.Add(time.Second * 2),
					},
					Interval:      100 * time.Millisecond,
					MaxDataPoints: 20,
					JSON:          sb,
				},
			},
		}

		rsp, err := s.QueryData(context.Background(), qr)
		require.NoError(t, err)
		require.NotNil(t, rsp)

		// Verify we got a response
		dr, ok := rsp.Responses["A"]
		require.True(t, ok)
		require.NoError(t, dr.Error)
		require.Len(t, dr.Frames, 1)

		frame := dr.Frames[0]
		// Should have time + (x, y, left, top, diameter, velocity) for each of 5 circles = 31 fields
		require.Equal(t, 31, len(frame.Fields))

		// Check field names
		require.Equal(t, "time", frame.Fields[0].Name)
		require.Equal(t, "circle_0_x", frame.Fields[1].Name)
		require.Equal(t, "circle_0_y", frame.Fields[2].Name)
		require.Equal(t, "circle_0_left", frame.Fields[3].Name)
		require.Equal(t, "circle_0_top", frame.Fields[4].Name)
		require.Equal(t, "circle_0_diameter", frame.Fields[5].Name)
		require.Equal(t, "circle_0_velocity", frame.Fields[6].Name)

		// Verify we have data points
		require.Greater(t, frame.Fields[0].Len(), 0)
	})

	t.Run("nbody with different configurations", func(t *testing.T) {
		testCases := []struct {
			name   string
			n      int
			width  float64
			height float64
			seed   int64
		}{
			{"small", 3, 200, 200, 1},
			{"medium", 10, 800, 600, 2},
			{"large", 20, 1000, 800, 3},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				sq := &simulationQuery{}
				sq.Key = simulationKey{
					Type:   "nbody",
					TickHZ: 10,
				}
				sq.Config = map[string]any{
					"n":      tc.n,
					"width":  tc.width,
					"height": tc.height,
					"seed":   tc.seed,
				}

				sb, err := json.Marshal(map[string]any{
					"sim": sq,
				})
				require.NoError(t, err)

				start := time.Now()
				qr := &backend.QueryDataRequest{
					Queries: []backend.DataQuery{
						{
							RefID: "A",
							TimeRange: backend.TimeRange{
								From: start,
								To:   start.Add(time.Second),
							},
							Interval:      100 * time.Millisecond,
							MaxDataPoints: 10,
							JSON:          sb,
						},
					},
				}

				rsp, err := s.QueryData(context.Background(), qr)
				require.NoError(t, err)
				require.NotNil(t, rsp)

				dr, ok := rsp.Responses["A"]
				require.True(t, ok)
				require.NoError(t, dr.Error)
				require.Len(t, dr.Frames, 1)

				frame := dr.Frames[0]
				// Should have time + (x, y, left, top, diameter, velocity) for each of N circles = 1 + 6*N fields
				expectedFields := 1 + 6*tc.n
				require.Equal(t, expectedFields, len(frame.Fields))
			})
		}
	})

	t.Run("nbody validates configuration", func(t *testing.T) {
		testCases := []struct {
			name        string
			config      map[string]any
			shouldError bool
		}{
			{"valid", map[string]any{"n": 5, "width": 400.0, "height": 300.0, "seed": 42}, false},
			{"zero n", map[string]any{"n": 0, "width": 400.0, "height": 300.0, "seed": 42}, true},
			{"negative n", map[string]any{"n": -5, "width": 400.0, "height": 300.0, "seed": 42}, true},
			{"zero width", map[string]any{"n": 5, "width": 0.0, "height": 300.0, "seed": 42}, true},
			{"negative height", map[string]any{"n": 5, "width": 400.0, "height": -300.0, "seed": 42}, true},
			{"too many bodies", map[string]any{"n": 150, "width": 400.0, "height": 300.0, "seed": 42}, true},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				sq := &simulationQuery{}
				sq.Key = simulationKey{
					Type:   "nbody",
					TickHZ: 10,
				}
				sq.Config = tc.config

				sb, err := json.Marshal(map[string]any{
					"sim": sq,
				})
				require.NoError(t, err)

				start := time.Now()
				qr := &backend.QueryDataRequest{
					Queries: []backend.DataQuery{
						{
							RefID: "A",
							TimeRange: backend.TimeRange{
								From: start,
								To:   start.Add(time.Second),
							},
							Interval:      100 * time.Millisecond,
							MaxDataPoints: 10,
							JSON:          sb,
						},
					},
				}

				rsp, err := s.QueryData(context.Background(), qr)

				if tc.shouldError {
					require.Error(t, err)
				} else {
					require.NoError(t, err)
					require.NotNil(t, rsp)
				}
			})
		}
	})
}

func TestNBodyCollisions(t *testing.T) {
	// Test that circles actually collide and bounce
	info := newNBodySimInfo()
	cfg := simulationState{
		Key: simulationKey{
			Type:   "nbody",
			TickHZ: 10,
		},
		Config: map[string]any{
			"n":      2,
			"width":  200.0,
			"height": 200.0,
			"seed":   12345,
		},
	}

	sim, err := info.create(cfg)
	require.NoError(t, err)
	require.NotNil(t, sim)

	// Get initial values
	t0 := time.Now()
	v0 := sim.GetValues(t0)

	// Simulate for 2 seconds
	t1 := t0.Add(2 * time.Second)
	v1 := sim.GetValues(t1)

	// Verify that positions have changed (circles are moving)
	require.NotEqual(t, v0["circle_0_x"], v1["circle_0_x"])
	require.NotEqual(t, v0["circle_0_y"], v1["circle_0_y"])

	// Verify diameters remain constant
	require.Equal(t, v0["circle_0_diameter"], v1["circle_0_diameter"])
	require.Equal(t, v0["circle_1_diameter"], v1["circle_1_diameter"])

	sim.Close()
}

