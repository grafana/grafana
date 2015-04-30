// Copyright 2010 The draw2d Authors. All rights reserved.
// created: 06/12/2010 by Laurent Le Goff

package draw2d

import (
	"math"
)

type PathConverter struct {
	converter                                     VertexConverter
	ApproximationScale, AngleTolerance, CuspLimit float64
	startX, startY, x, y                          float64
}

func NewPathConverter(converter VertexConverter) *PathConverter {
	return &PathConverter{converter, 1, 0, 0, 0, 0, 0, 0}
}

func (c *PathConverter) Convert(paths ...*PathStorage) {
	for _, path := range paths {
		j := 0
		for _, cmd := range path.commands {
			j = j + c.ConvertCommand(cmd, path.vertices[j:]...)
		}
		c.converter.NextCommand(VertexStopCommand)
	}
}

func (c *PathConverter) ConvertCommand(cmd PathCmd, vertices ...float64) int {
	switch cmd {
	case MoveTo:
		c.x, c.y = vertices[0], vertices[1]
		c.startX, c.startY = c.x, c.y
		c.converter.NextCommand(VertexStopCommand)
		c.converter.NextCommand(VertexStartCommand)
		c.converter.Vertex(c.x, c.y)
		return 2
	case LineTo:
		c.x, c.y = vertices[0], vertices[1]
		if c.startX == c.x && c.startY == c.y {
			c.converter.NextCommand(VertexCloseCommand)
		}
		c.converter.Vertex(c.x, c.y)
		c.converter.NextCommand(VertexJoinCommand)
		return 2
	case QuadCurveTo:
		quadraticBezier(c.converter, c.x, c.y, vertices[0], vertices[1], vertices[2], vertices[3], c.ApproximationScale, c.AngleTolerance)
		c.x, c.y = vertices[2], vertices[3]
		if c.startX == c.x && c.startY == c.y {
			c.converter.NextCommand(VertexCloseCommand)
		}
		c.converter.Vertex(c.x, c.y)
		return 4
	case CubicCurveTo:
		cubicBezier(c.converter, c.x, c.y, vertices[0], vertices[1], vertices[2], vertices[3], vertices[4], vertices[5], c.ApproximationScale, c.AngleTolerance, c.CuspLimit)
		c.x, c.y = vertices[4], vertices[5]
		if c.startX == c.x && c.startY == c.y {
			c.converter.NextCommand(VertexCloseCommand)
		}
		c.converter.Vertex(c.x, c.y)
		return 6
	case ArcTo:
		c.x, c.y = arc(c.converter, vertices[0], vertices[1], vertices[2], vertices[3], vertices[4], vertices[5], c.ApproximationScale)
		if c.startX == c.x && c.startY == c.y {
			c.converter.NextCommand(VertexCloseCommand)
		}
		c.converter.Vertex(c.x, c.y)
		return 6
	case Close:
		c.converter.NextCommand(VertexCloseCommand)
		c.converter.Vertex(c.startX, c.startY)
		return 0
	}
	return 0
}

func (c *PathConverter) MoveTo(x, y float64) *PathConverter {
	c.x, c.y = x, y
	c.startX, c.startY = c.x, c.y
	c.converter.NextCommand(VertexStopCommand)
	c.converter.NextCommand(VertexStartCommand)
	c.converter.Vertex(c.x, c.y)
	return c
}

func (c *PathConverter) RMoveTo(dx, dy float64) *PathConverter {
	c.MoveTo(c.x+dx, c.y+dy)
	return c
}

func (c *PathConverter) LineTo(x, y float64) *PathConverter {
	c.x, c.y = x, y
	if c.startX == c.x && c.startY == c.y {
		c.converter.NextCommand(VertexCloseCommand)
	}
	c.converter.Vertex(c.x, c.y)
	c.converter.NextCommand(VertexJoinCommand)
	return c
}

func (c *PathConverter) RLineTo(dx, dy float64) *PathConverter {
	c.LineTo(c.x+dx, c.y+dy)
	return c
}

func (c *PathConverter) QuadCurveTo(cx, cy, x, y float64) *PathConverter {
	quadraticBezier(c.converter, c.x, c.y, cx, cy, x, y, c.ApproximationScale, c.AngleTolerance)
	c.x, c.y = x, y
	if c.startX == c.x && c.startY == c.y {
		c.converter.NextCommand(VertexCloseCommand)
	}
	c.converter.Vertex(c.x, c.y)
	return c
}

func (c *PathConverter) RQuadCurveTo(dcx, dcy, dx, dy float64) *PathConverter {
	c.QuadCurveTo(c.x+dcx, c.y+dcy, c.x+dx, c.y+dy)
	return c
}

func (c *PathConverter) CubicCurveTo(cx1, cy1, cx2, cy2, x, y float64) *PathConverter {
	cubicBezier(c.converter, c.x, c.y, cx1, cy1, cx2, cy2, x, y, c.ApproximationScale, c.AngleTolerance, c.CuspLimit)
	c.x, c.y = x, y
	if c.startX == c.x && c.startY == c.y {
		c.converter.NextCommand(VertexCloseCommand)
	}
	c.converter.Vertex(c.x, c.y)
	return c
}

func (c *PathConverter) RCubicCurveTo(dcx1, dcy1, dcx2, dcy2, dx, dy float64) *PathConverter {
	c.CubicCurveTo(c.x+dcx1, c.y+dcy1, c.x+dcx2, c.y+dcy2, c.x+dx, c.y+dy)
	return c
}

func (c *PathConverter) ArcTo(cx, cy, rx, ry, startAngle, angle float64) *PathConverter {
	endAngle := startAngle + angle
	clockWise := true
	if angle < 0 {
		clockWise = false
	}
	// normalize
	if clockWise {
		for endAngle < startAngle {
			endAngle += math.Pi * 2.0
		}
	} else {
		for startAngle < endAngle {
			startAngle += math.Pi * 2.0
		}
	}
	startX := cx + math.Cos(startAngle)*rx
	startY := cy + math.Sin(startAngle)*ry
	c.MoveTo(startX, startY)
	c.x, c.y = arc(c.converter, cx, cy, rx, ry, startAngle, angle, c.ApproximationScale)
	if c.startX == c.x && c.startY == c.y {
		c.converter.NextCommand(VertexCloseCommand)
	}
	c.converter.Vertex(c.x, c.y)
	return c
}

func (c *PathConverter) RArcTo(dcx, dcy, rx, ry, startAngle, angle float64) *PathConverter {
	c.ArcTo(c.x+dcx, c.y+dcy, rx, ry, startAngle, angle)
	return c
}

func (c *PathConverter) Close() *PathConverter {
	c.converter.NextCommand(VertexCloseCommand)
	c.converter.Vertex(c.startX, c.startY)
	return c
}
