package sims

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"math"
	"time"

	"bytes"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

//go:embed grot_mesh.json
var grotMeshData []byte

//go:embed grot_base_color.png
var grotBaseColor []byte

type grot3dSim struct {
	key      simulationKey
	cfg      grot3dConfig
	state    grot3dState
	vertices []point3d
	uvs      [][]float64
	indices  []int
	texture  image.Image
}

var (
	_ Simulation = (*grot3dSim)(nil)
)

type grot3dConfig struct {
	RotationSpeedX float64 `json:"rotationSpeedX"` // Rotation speed around X axis (degrees/second)
	RotationSpeedY float64 `json:"rotationSpeedY"` // Rotation speed around Y axis (degrees/second)
	RotationSpeedZ float64 `json:"rotationSpeedZ"` // Rotation speed around Z axis (degrees/second)
	MinAngleX      float64 `json:"minAngleX"`      // Minimum rotation angle for X axis (degrees)
	MaxAngleX      float64 `json:"maxAngleX"`      // Maximum rotation angle for X axis (degrees)
	MinAngleY      float64 `json:"minAngleY"`      // Minimum rotation angle for Y axis (degrees)
	MaxAngleY      float64 `json:"maxAngleY"`      // Maximum rotation angle for Y axis (degrees)
	MinAngleZ      float64 `json:"minAngleZ"`      // Minimum rotation angle for Z axis (degrees)
	MaxAngleZ      float64 `json:"maxAngleZ"`      // Maximum rotation angle for Z axis (degrees)
	ViewWidth      float64 `json:"viewWidth"`      // SVG viewBox width
	ViewHeight     float64 `json:"viewHeight"`     // SVG viewBox height
	Perspective    float64 `json:"perspective"`    // Perspective distance (larger = less perspective)
	Scale          float64 `json:"scale"`          // Overall scale multiplier
}

type grot3dState struct {
	lastTime   time.Time
	angleX     float64 // Current rotation around X axis (radians)
	angleY     float64 // Current rotation around Y axis (radians)
	angleZ     float64 // Current rotation around Z axis (radians)
	directionX float64 // Direction multiplier for X rotation (+1 or -1)
	directionY float64 // Direction multiplier for Y rotation (+1 or -1)
	directionZ float64 // Direction multiplier for Z rotation (+1 or -1)
}

type point3d struct {
	x, y, z float64
}

type point2d struct {
	x, y float64
}

type meshData struct {
	Vertices [][]float64 `json:"vertices"`
	Uvs      [][]float64 `json:"uvs"`
	Indices  []int       `json:"indices"`
}

type triangleWithDepth struct {
	v0, v1, v2       point2d
	depth            float64
	visible          bool
	idx0, idx1, idx2 int
}

func (s *grot3dSim) GetState() simulationState {
	return simulationState{
		Key:    s.key,
		Config: s.cfg,
	}
}

func (s *grot3dSim) SetConfig(vals map[string]any) error {
	return updateConfigObjectFromJSON(&s.cfg, vals)
}

func (s *grot3dSim) initialize() error {
	s.state.lastTime = time.Time{}
	s.state.angleX = 0
	s.state.angleY = 0
	s.state.angleZ = 0
	s.state.directionX = 1
	s.state.directionY = 1
	s.state.directionZ = 1

	// Load mesh data if not already loaded
	if len(s.vertices) == 0 {
		var mesh meshData
		if err := json.Unmarshal(grotMeshData, &mesh); err != nil {
			return fmt.Errorf("failed to load grot holiday mesh data: %w", err)
		}

		// Convert to point3d
		s.vertices = make([]point3d, len(mesh.Vertices))
		for i, v := range mesh.Vertices {
			if len(v) != 3 {
				return fmt.Errorf("invalid vertex data at index %d", i)
			}
			s.vertices[i] = point3d{x: v[0], y: v[1], z: v[2]}
		}

		s.uvs = mesh.Uvs

		if len(s.uvs) != len(s.vertices) {
			return fmt.Errorf("UV count mismatch: %d vs %d", len(s.uvs), len(s.vertices))
		}

		s.indices = mesh.Indices
	}

	// Load texture
	img, err := png.Decode(bytes.NewReader(grotBaseColor))
	if err != nil {
		return fmt.Errorf("failed to decode texture: %w", err)
	}
	s.texture = img

	return nil
}

func (s *grot3dSim) NewFrame(size int) *data.Frame {
	frame := data.NewFrame("")

	// Time field
	frame.Fields = append(frame.Fields, data.NewField("time", nil, make([]time.Time, size)))

	// SVG content field (string)
	frame.Fields = append(frame.Fields, data.NewField("svg_content", nil, make([]string, size)))

	// Also add rotation angles for reference/debugging
	frame.Fields = append(frame.Fields, data.NewField("angle_x", nil, make([]float64, size)))
	frame.Fields = append(frame.Fields, data.NewField("angle_y", nil, make([]float64, size)))
	frame.Fields = append(frame.Fields, data.NewField("angle_z", nil, make([]float64, size)))

	return frame
}

func (s *grot3dSim) GetValues(t time.Time) map[string]any {
	// Initialize if this is the first call
	if s.state.lastTime.IsZero() {
		s.state.lastTime = t
	}

	// Calculate elapsed time and update rotation
	if t.After(s.state.lastTime) {
		dt := t.Sub(s.state.lastTime).Seconds()
		s.updateRotation(dt)
		s.state.lastTime = t
	} else if t.Before(s.state.lastTime) {
		// Can't go backwards - reinitialize
		s.initialize()
		s.state.lastTime = t
	}

	// Generate the SVG content for the current rotation
	svgContent := s.generateSVG()

	return map[string]any{
		"time":        t,
		"svg_content": svgContent,
		"angle_x":     s.state.angleX * 180 / math.Pi, // Convert to degrees for display
		"angle_y":     s.state.angleY * 180 / math.Pi,
		"angle_z":     s.state.angleZ * 180 / math.Pi,
	}
}

func (s *grot3dSim) updateRotation(dt float64) {
	// Update X rotation
	if s.cfg.MinAngleX == 0 && s.cfg.MaxAngleX == 0 {
		// No limits - continuous rotation
		s.state.angleX += s.cfg.RotationSpeedX * dt * math.Pi / 180
		s.state.angleX = math.Mod(s.state.angleX, 2*math.Pi)
	} else {
		// Bouncing rotation with limits
		minAngleX := s.cfg.MinAngleX * math.Pi / 180
		maxAngleX := s.cfg.MaxAngleX * math.Pi / 180
		s.state.angleX += s.cfg.RotationSpeedX * dt * math.Pi / 180 * s.state.directionX
		if s.state.angleX >= maxAngleX {
			s.state.angleX = maxAngleX
			s.state.directionX = -1
		} else if s.state.angleX <= minAngleX {
			s.state.angleX = minAngleX
			s.state.directionX = 1
		}
	}

	// Update Y rotation
	if s.cfg.MinAngleY == 0 && s.cfg.MaxAngleY == 0 {
		// No limits - continuous rotation
		s.state.angleY += s.cfg.RotationSpeedY * dt * math.Pi / 180
		s.state.angleY = math.Mod(s.state.angleY, 2*math.Pi)
	} else {
		// Bouncing rotation with limits
		minAngleY := s.cfg.MinAngleY * math.Pi / 180
		maxAngleY := s.cfg.MaxAngleY * math.Pi / 180
		s.state.angleY += s.cfg.RotationSpeedY * dt * math.Pi / 180 * s.state.directionY
		if s.state.angleY >= maxAngleY {
			s.state.angleY = maxAngleY
			s.state.directionY = -1
		} else if s.state.angleY <= minAngleY {
			s.state.angleY = minAngleY
			s.state.directionY = 1
		}
	}

	// Update Z rotation
	if s.cfg.MinAngleZ == 0 && s.cfg.MaxAngleZ == 0 {
		// No limits - continuous rotation
		s.state.angleZ += s.cfg.RotationSpeedZ * dt * math.Pi / 180
		s.state.angleZ = math.Mod(s.state.angleZ, 2*math.Pi)
	} else {
		// Bouncing rotation with limits
		minAngleZ := s.cfg.MinAngleZ * math.Pi / 180
		maxAngleZ := s.cfg.MaxAngleZ * math.Pi / 180
		s.state.angleZ += s.cfg.RotationSpeedZ * dt * math.Pi / 180 * s.state.directionZ
		if s.state.angleZ >= maxAngleZ {
			s.state.angleZ = maxAngleZ
			s.state.directionZ = -1
		} else if s.state.angleZ <= minAngleZ {
			s.state.angleZ = minAngleZ
			s.state.directionZ = 1
		}
	}
}

// rotatePoint3D applies 3D rotation around X, Y, and Z axes
func (s *grot3dSim) rotatePoint3D(p point3d) point3d {
	// Rotate around X axis
	cosX, sinX := math.Cos(s.state.angleX), math.Sin(s.state.angleX)
	y := p.y*cosX - p.z*sinX
	z := p.y*sinX + p.z*cosX
	p.y, p.z = y, z

	// Rotate around Y axis
	cosY, sinY := math.Cos(s.state.angleY), math.Sin(s.state.angleY)
	x := p.x*cosY + p.z*sinY
	z = -p.x*sinY + p.z*cosY
	p.x, p.z = x, z

	// Rotate around Z axis
	cosZ, sinZ := math.Cos(s.state.angleZ), math.Sin(s.state.angleZ)
	x = p.x*cosZ - p.y*sinZ
	y = p.x*sinZ + p.y*cosZ
	p.x, p.y = x, y

	return p
}

// project3DTo2D converts 3D point to 2D using perspective projection
func (s *grot3dSim) project3DTo2D(p point3d) point2d {
	// Apply scale
	scaledP := point3d{
		x: p.x * s.cfg.Scale,
		y: p.y * s.cfg.Scale,
		z: p.z * s.cfg.Scale,
	}

	// Apply perspective projection
	scale := s.cfg.Perspective / (s.cfg.Perspective + scaledP.z)

	return point2d{
		x: scaledP.x*scale + s.cfg.ViewWidth/2,
		y: scaledP.y*scale + s.cfg.ViewHeight/2,
	}
}

func (s *grot3dSim) generateSVG() string {
	// Rotate all vertices
	rotatedVertices := make([]point3d, len(s.vertices))
	for i, v := range s.vertices {
		rotatedVertices[i] = s.rotatePoint3D(v)
	}

	// Project to 2D
	projectedVertices := make([]point2d, len(rotatedVertices))
	for i, v := range rotatedVertices {
		projectedVertices[i] = s.project3DTo2D(v)
	}

	// Process triangles for depth sorting and backface culling
	triangles := make([]triangleWithDepth, 0, len(s.indices)/3)

	// Calculate near plane for clipping
	nearPlane := -s.cfg.Perspective * 0.9 / s.cfg.Scale

	for i := 0; i < len(s.indices); i += 3 {
		idx0 := s.indices[i]
		idx1 := s.indices[i+1]
		idx2 := s.indices[i+2]

		v0 := rotatedVertices[idx0]
		v1 := rotatedVertices[idx1]
		v2 := rotatedVertices[idx2]

		// Near-plane clipping: skip triangles too close to camera
		if v0.z < nearPlane || v1.z < nearPlane || v2.z < nearPlane {
			continue
		}

		// Calculate triangle center depth for sorting
		centerZ := (v0.z + v1.z + v2.z) / 3

		// Calculate face normal for backface culling
		// Two edges of the triangle
		edge1 := point3d{v1.x - v0.x, v1.y - v0.y, v1.z - v0.z}
		edge2 := point3d{v2.x - v0.x, v2.y - v0.y, v2.z - v0.z}

		// Cross product gives normal
		normal := point3d{
			x: edge1.y*edge2.z - edge1.z*edge2.y,
			y: edge1.z*edge2.x - edge1.x*edge2.z,
			z: edge1.x*edge2.y - edge1.y*edge2.x,
		}

		// Normalize the normal vector
		normalMag := math.Sqrt(normal.x*normal.x + normal.y*normal.y + normal.z*normal.z)
		if normalMag > 0 {
			normal.x /= normalMag
			normal.y /= normalMag
			normal.z /= normalMag
		}

		// View vector (camera is looking along -Z axis)
		viewVector := point3d{0, 0, -1}

		// Dot product of normal and view vector (now both are unit vectors)
		dotProduct := normal.x*viewVector.x + normal.y*viewVector.y + normal.z*viewVector.z

		// Only render triangles facing the camera (backface culling)
		// Use small tolerance to catch edge-on triangles (dot product is now -1 to 1)
		visible := dotProduct < 0.2

		triangles = append(triangles, triangleWithDepth{
			v0:      projectedVertices[idx0],
			v1:      projectedVertices[idx1],
			v2:      projectedVertices[idx2],
			depth:   centerZ,
			visible: visible,
			idx0:    idx0,
			idx1:    idx1,
			idx2:    idx2,
		})
	}

	// Sort triangles by depth (painter's algorithm - draw furthest first)
	for i := 0; i < len(triangles); i++ {
		for j := i + 1; j < len(triangles); j++ {
			if triangles[i].depth > triangles[j].depth {
				triangles[i], triangles[j] = triangles[j], triangles[i]
			}
		}
	}

	// Build SVG string
	svg := fmt.Sprintf("<svg viewBox='0 0 %.0f %.0f' xmlns='http://www.w3.org/2000/svg' stroke='none'>",
		s.cfg.ViewWidth, s.cfg.ViewHeight)

	// Calculate colors for all visible triangles and group by color
	type triangleWithColor struct {
		tri     triangleWithDepth
		color   string
		opacity string
	}
	
	coloredTriangles := make([]triangleWithColor, 0, len(triangles))
	bounds := s.texture.Bounds()
	
	for _, tri := range triangles {
		if !tri.visible {
			continue
		}

		// Use depth for shading (closer = lighter)
		intensity := 0.5 + (tri.depth+150)/300*0.5
		if intensity < 0.5 {
			intensity = 0.5
		}
		if intensity > 1.0 {
			intensity = 1.0
		}

		// Get centroid UV
		uv0 := s.uvs[tri.idx0]
		uv1 := s.uvs[tri.idx1]
		uv2 := s.uvs[tri.idx2]

		centU := (uv0[0] + uv1[0] + uv2[0]) / 3
		centV := (uv0[1] + uv1[1] + uv2[1]) / 3

		// Clamp UVs to 0-1
		centU = math.Max(0, math.Min(1, centU))
		centV = math.Max(0, math.Min(1, centV))

		// Sample texture - no V flip
		x := int(centU * float64(bounds.Dx()-1))
		y := int(centV * float64(bounds.Dy()-1))

		c := s.texture.At(x, y).(color.RGBA)

		// Apply depth intensity to the sampled color
		r := int(float64(c.R) * intensity)
		g := int(float64(c.G) * intensity)
		b := int(float64(c.B) * intensity)

		// Quantize colors to reduce palette (round to nearest 16)
		r = (r / 16) * 16
		g = (g / 16) * 16
		b = (b / 16) * 16

		colorStr := fmt.Sprintf("#%02x%02x%02x", r, g, b)

		opacityStr := ""
		if c.A < 255 {
			opacityStr = fmt.Sprintf("%.2f", float64(c.A)/255)
		}

		coloredTriangles = append(coloredTriangles, triangleWithColor{
			tri:     tri,
			color:   colorStr,
			opacity: opacityStr,
		})
	}

	// Group triangles by color and render
	i := 0
	for i < len(coloredTriangles) {
		currentColor := coloredTriangles[i].color
		currentOpacity := coloredTriangles[i].opacity
		
		// Build path data for all triangles with the same color
		pathData := ""
		for i < len(coloredTriangles) && 
			coloredTriangles[i].color == currentColor && 
			coloredTriangles[i].opacity == currentOpacity {
			
			tri := coloredTriangles[i].tri
			pathData += fmt.Sprintf(
				"M%.2f,%.2fL%.2f,%.2fL%.2f,%.2fZ",
				tri.v0.x, tri.v0.y,
				tri.v1.x, tri.v1.y,
				tri.v2.x, tri.v2.y,
			)
			i++
		}
		
		// Output single path with all triangles
		if currentOpacity != "" {
			svg += fmt.Sprintf("<path fill='%s' opacity='%s' d='%s'/>", currentColor, currentOpacity, pathData)
		} else {
			svg += fmt.Sprintf("<path fill='%s' d='%s'/>", currentColor, pathData)
		}
	}

	svg += "</svg>"
	return svg
}

func (s *grot3dSim) Close() error {
	return nil
}

func newGrot3dSimInfo() simulationInfo {
	return simulationInfo{
		Type:        "grot3d",
		Name:        "Rotating 3D Grot",
		Description: "Renders a rotating 3D grot model using SVG triangles",
		OnlyForward: false,
		ConfigFields: data.NewFrame("config",
			data.NewField("rotationSpeedX", nil, []float64{0}),
			data.NewField("rotationSpeedY", nil, []float64{5}),
			data.NewField("rotationSpeedZ", nil, []float64{30}),
			data.NewField("minAngleX", nil, []float64{-45}),
			data.NewField("maxAngleX", nil, []float64{45}),
			data.NewField("minAngleY", nil, []float64{-45}),
			data.NewField("maxAngleY", nil, []float64{45}),
			data.NewField("minAngleZ", nil, []float64{0}),
			data.NewField("maxAngleZ", nil, []float64{0}),
			data.NewField("viewWidth", nil, []float64{800}),
			data.NewField("viewHeight", nil, []float64{800}),
			data.NewField("perspective", nil, []float64{1000}),
			data.NewField("scale", nil, []float64{5.0}),
		),
		create: func(state simulationState) (Simulation, error) {
			sim := &grot3dSim{
				key: state.Key,
				cfg: grot3dConfig{
					RotationSpeedX: 0,
					RotationSpeedY: 5,
					RotationSpeedZ: 30,
					MinAngleX:      -45,
					MaxAngleX:      45,
					MinAngleY:      -45,
					MaxAngleY:      45,
					MinAngleZ:      0,
					MaxAngleZ:      0,
					ViewWidth:      800,
					ViewHeight:     800,
					Perspective:    1000,
					Scale:          5.0,
				},
			}

			if state.Config != nil {
				vals, ok := state.Config.(map[string]any)
				if ok {
					err := sim.SetConfig(vals)
					if err != nil {
						return nil, err
					}
				}
			}

			if err := sim.initialize(); err != nil {
				return nil, err
			}
			return sim, nil
		},
	}
}
