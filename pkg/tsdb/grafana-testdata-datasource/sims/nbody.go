package sims

import (
	"fmt"
	"math"
	"math/rand"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type nbodySim struct {
	key    simulationKey
	cfg    nbodyConfig
	state  nbodyState
	random *rand.Rand
}

var (
	_ Simulation = (*nbodySim)(nil)
)

type nbodyConfig struct {
	N      int     `json:"n"`      // number of bodies
	Width  float64 `json:"width"`  // boundary width in pixels
	Height float64 `json:"height"` // boundary height in pixels
	Seed   int64   `json:"seed"`   // random seed for reproducibility
}

type circle struct {
	x        float64 // x position
	y        float64 // y position
	vx       float64 // x velocity
	vy       float64 // y velocity
	radius   float64 // radius
	mass     float64 // mass (proportional to radius^2 for simplicity)
	rotation float64 // current rotation angle in degrees (0-360)
}

type nbodyState struct {
	lastTime time.Time
	circles  []circle
}

func (s *nbodySim) GetState() simulationState {
	return simulationState{
		Key:    s.key,
		Config: s.cfg,
	}
}

func (s *nbodySim) SetConfig(vals map[string]any) error {
	oldCfg := s.cfg
	err := updateConfigObjectFromJSON(&s.cfg, vals)
	if err != nil {
		return err
	}

	// If configuration changed, reinitialize the simulation
	if oldCfg.N != s.cfg.N || oldCfg.Width != s.cfg.Width || oldCfg.Height != s.cfg.Height || oldCfg.Seed != s.cfg.Seed {
		s.initialize()
	}

	return nil
}

func (s *nbodySim) initialize() {
	s.random = rand.New(rand.NewSource(s.cfg.Seed))
	s.state.circles = make([]circle, s.cfg.N)
	s.state.lastTime = time.Time{}

	const maxRadius = 30.0
	const bossRadius = maxRadius * 2.0 // Boss is twice the max radius (60 pixels)

	// Generate random circles (first one is the boss, rest are normal)
	for i := 0; i < s.cfg.N; i++ {
		var radius float64
		
		// First circle is always the "boss" with double radius
		if i == 0 || i == 1  {
			radius = bossRadius
		} else {
			// Random radius between 5 and 30 pixels for normal circles
			radius = 5.0 + s.random.Float64()*25.0
		}

		// Random position ensuring the circle is within bounds
		x := radius + s.random.Float64()*(s.cfg.Width-2*radius)
		y := radius + s.random.Float64()*(s.cfg.Height-2*radius)

		// Random velocity between -250 and 250 pixels/second
		vx := (s.random.Float64()*2.0 - 1.0) * 250.0
		vy := (s.random.Float64()*2.0 - 1.0) * 250.0

		// Mass proportional to area (radius squared)
		mass := radius * radius

		// Initial rotation based on initial velocity
		rotation := math.Atan2(vy, vx) * 180.0 / math.Pi
		if rotation < 0 {
			rotation += 360.0
		}

		s.state.circles[i] = circle{
			x:        x,
			y:        y,
			vx:       vx,
			vy:       vy,
			radius:   radius,
			mass:     mass,
			rotation: rotation,
		}
	}
}

func (s *nbodySim) NewFrame(size int) *data.Frame {
	frame := data.NewFrame("")

	// Time field - create with length=size for pre-allocated storage
	frame.Fields = append(frame.Fields, data.NewField("time", nil, make([]time.Time, size)))

	// For each circle, add position, bounding box, size, velocity, and rotation fields with pre-allocated storage
	for i := 0; i < s.cfg.N; i++ {
		frame.Fields = append(frame.Fields,
			data.NewField(fmt.Sprintf("circle_%d_x", i), nil, make([]float64, size)),
		)
		frame.Fields = append(frame.Fields,
			data.NewField(fmt.Sprintf("circle_%d_y", i), nil, make([]float64, size)),
		)
		frame.Fields = append(frame.Fields,
			data.NewField(fmt.Sprintf("circle_%d_left", i), nil, make([]float64, size)),
		)
		frame.Fields = append(frame.Fields,
			data.NewField(fmt.Sprintf("circle_%d_top", i), nil, make([]float64, size)),
		)
		frame.Fields = append(frame.Fields,
			data.NewField(fmt.Sprintf("circle_%d_diameter", i), nil, make([]float64, size)),
		)
		frame.Fields = append(frame.Fields,
			data.NewField(fmt.Sprintf("circle_%d_velocity", i), nil, make([]float64, size)),
		)
		frame.Fields = append(frame.Fields,
			data.NewField(fmt.Sprintf("circle_%d_rotation", i), nil, make([]float64, size)),
		)
	}

	return frame
}

func (s *nbodySim) GetValues(t time.Time) map[string]any {
	// Initialize if this is the first call
	if s.state.lastTime.IsZero() {
		s.state.lastTime = t
		if len(s.state.circles) == 0 {
			s.initialize()
		}
	}

	// Calculate elapsed time in seconds
	if t.After(s.state.lastTime) {
		dt := t.Sub(s.state.lastTime).Seconds()
		s.simulate(dt)
		s.state.lastTime = t
	} else if t.Before(s.state.lastTime) {
		// Can't go backwards - reinitialize
		s.initialize()
		s.state.lastTime = t
	}

	// Build result map
	result := map[string]any{
		"time": t,
	}

	for i := 0; i < len(s.state.circles); i++ {
		c := s.state.circles[i]
		// Calculate velocity magnitude: sqrt(vx^2 + vy^2)
		velocity := math.Sqrt(c.vx*c.vx + c.vy*c.vy)
		
		// Center position
		result[fmt.Sprintf("circle_%d_x", i)] = c.x
		result[fmt.Sprintf("circle_%d_y", i)] = c.y
		
		// Top-left corner of bounding box (for easier canvas positioning)
		result[fmt.Sprintf("circle_%d_left", i)] = c.x - c.radius
		result[fmt.Sprintf("circle_%d_top", i)] = c.y - c.radius
		
		// Size, velocity, and rotation (smoothed rotation from simulate)
		result[fmt.Sprintf("circle_%d_diameter", i)] = c.radius * 2.0
		result[fmt.Sprintf("circle_%d_velocity", i)] = velocity
		result[fmt.Sprintf("circle_%d_rotation", i)] = c.rotation
	}

	return result
}

func (s *nbodySim) simulate(dt float64) {
	// Don't simulate too large time steps
	if dt > 1.0 {
		dt = 1.0
	}

	// Use smaller sub-steps for more accurate collision detection
	steps := int(math.Ceil(dt * 60)) // 60 sub-steps per second
	if steps < 1 {
		steps = 1
	}
	subDt := dt / float64(steps)

	for step := 0; step < steps; step++ {
		// Calculate and apply gravitational forces between all pairs
		// G scaled for pixel world: smaller masses, pixel distances
		const G = 5000.0 // Gravitational constant scaled for our pixel world
		
		for i := 0; i < len(s.state.circles); i++ {
			for j := i + 1; j < len(s.state.circles); j++ {
				c1 := &s.state.circles[i]
				c2 := &s.state.circles[j]

				// Calculate distance between centers
				dx := c2.x - c1.x
				dy := c2.y - c1.y
				distSq := dx*dx + dy*dy
				
				// Avoid division by zero and extremely strong forces at close range
				const minDist = 10.0 // Minimum distance to prevent extreme forces
				if distSq < minDist*minDist {
					distSq = minDist * minDist
				}

				dist := math.Sqrt(distSq)

				// Calculate gravitational force magnitude: F = G * m1 * m2 / r^2
				force := G * c1.mass * c2.mass / distSq

				// Calculate force components (normalized direction * force)
				fx := (dx / dist) * force
				fy := (dy / dist) * force

				// Apply acceleration to both particles (F = ma -> a = F/m)
				// c1 is attracted to c2 (positive direction)
				c1.vx += (fx / c1.mass) * subDt
				c1.vy += (fy / c1.mass) * subDt

				// c2 is attracted to c1 (negative direction, by Newton's 3rd law)
				c2.vx -= (fx / c2.mass) * subDt
				c2.vy -= (fy / c2.mass) * subDt
			}
		}

		// Update positions
		for i := range s.state.circles {
			s.state.circles[i].x += s.state.circles[i].vx * subDt
			s.state.circles[i].y += s.state.circles[i].vy * subDt
		}

		// Handle wall collisions
		for i := range s.state.circles {
			c := &s.state.circles[i]

			// Left/right walls (perfectly elastic - no energy loss)
			if c.x-c.radius < 0 {
				c.x = c.radius
				c.vx = math.Abs(c.vx)
			} else if c.x+c.radius > s.cfg.Width {
				c.x = s.cfg.Width - c.radius
				c.vx = -math.Abs(c.vx)
			}

			// Top/bottom walls (perfectly elastic - no energy loss)
			if c.y-c.radius < 0 {
				c.y = c.radius
				c.vy = math.Abs(c.vy)
			} else if c.y+c.radius > s.cfg.Height {
				c.y = s.cfg.Height - c.radius
				c.vy = -math.Abs(c.vy)
			}
		}

		// Handle circle-to-circle collisions
		for i := 0; i < len(s.state.circles); i++ {
			for j := i + 1; j < len(s.state.circles); j++ {
				c1 := &s.state.circles[i]
				c2 := &s.state.circles[j]

				// Calculate distance between centers
				dx := c2.x - c1.x
				dy := c2.y - c1.y
				distSq := dx*dx + dy*dy
				minDist := c1.radius + c2.radius

				// Check for collision
				if distSq < minDist*minDist && distSq > 0 {
					dist := math.Sqrt(distSq)

					// Normalize collision vector
					nx := dx / dist
					ny := dy / dist

					// Separate the circles so they don't overlap
					overlap := minDist - dist
					c1.x -= nx * overlap * 0.5
					c1.y -= ny * overlap * 0.5
					c2.x += nx * overlap * 0.5
					c2.y += ny * overlap * 0.5

					// Calculate relative velocity
					dvx := c2.vx - c1.vx
					dvy := c2.vy - c1.vy

				// Calculate relative velocity in collision normal direction
				dvn := dvx*nx + dvy*ny

				// Do not resolve if velocities are separating
				if dvn > 0 {
					continue
				}

				// Calculate impulse scalar (perfectly elastic collision)
				restitution := 1.0 // coefficient of restitution (1.0 = perfectly elastic, no energy loss)
				impulse := (1 + restitution) * dvn / (1/c1.mass + 1/c2.mass)

					// Apply impulse
					c1.vx += impulse * nx / c1.mass
					c1.vy += impulse * ny / c1.mass
					c2.vx -= impulse * nx / c2.mass
					c2.vy -= impulse * ny / c2.mass
				}
			}
		}

		// Update rotations smoothly based on velocity direction
		// Maximum rotation change per sub-step (in degrees)
		// At 60 sub-steps/sec, 1.5 degrees/step = 90 degrees/second max
		const maxRotationChange = 5

		for i := range s.state.circles {
			c := &s.state.circles[i]

			// Calculate target rotation from velocity vector
			targetRotation := math.Atan2(c.vy, c.vx) * 180.0 / math.Pi
			if targetRotation < 0 {
				targetRotation += 360.0
			}

			// Calculate the shortest angular difference (handles wrap-around)
			diff := targetRotation - c.rotation
			if diff > 180.0 {
				diff -= 360.0
			} else if diff < -180.0 {
				diff += 360.0
			}

			// Clamp the rotation change
			if diff > maxRotationChange {
				diff = maxRotationChange
			} else if diff < -maxRotationChange {
				diff = -maxRotationChange
			}

			// Apply the clamped rotation change
			c.rotation += diff

			// Keep rotation in 0-360 range
			if c.rotation >= 360.0 {
				c.rotation -= 360.0
			} else if c.rotation < 0 {
				c.rotation += 360.0
			}
		}
	}
}

func (s *nbodySim) Close() error {
	return nil
}

func newNBodySimInfo() simulationInfo {
	defaultCfg := nbodyConfig{
		N:      10,
		Width:  800,
		Height: 600,
		Seed:   12345,
	}

	// Create config frame that describes the available configuration fields
	df := data.NewFrame("")
	df.Fields = append(df.Fields, data.NewField("n", nil, []int64{int64(defaultCfg.N)}))
	df.Fields = append(df.Fields, data.NewField("width", nil, []float64{defaultCfg.Width}).SetConfig(&data.FieldConfig{
		Unit: "px",
	}))
	df.Fields = append(df.Fields, data.NewField("height", nil, []float64{defaultCfg.Height}).SetConfig(&data.FieldConfig{
		Unit: "px",
	}))
	df.Fields = append(df.Fields, data.NewField("seed", nil, []int64{defaultCfg.Seed}))

	return simulationInfo{
		Type:         "nbody",
		Name:         "N-Body",
		Description:  "N-body collision simulation with circles bouncing in a bounded space",
		ConfigFields: df,
		OnlyForward:  false,
		create: func(cfg simulationState) (Simulation, error) {
			s := &nbodySim{
				key: cfg.Key,
				cfg: defaultCfg,
			}
			err := updateConfigObjectFromJSON(&s.cfg, cfg.Config)
			if err != nil {
				return nil, err
			}

		// Validate configuration
		if s.cfg.N <= 0 {
			return nil, fmt.Errorf("n must be positive")
		}
		if s.cfg.Width <= 0 || s.cfg.Height <= 0 {
			return nil, fmt.Errorf("width and height must be positive")
		}
		if s.cfg.N > 100 {
			return nil, fmt.Errorf("n is too large (max 100)")
		}

			s.initialize()
			return s, nil
		},
	}
}

