// Copyright 2010 The draw2d Authors. All rights reserved.
// created: 21/11/2010 by Laurent Le Goff

package draw2d

import (
	"fmt"
	"math"
)

type PathCmd int

const (
	MoveTo PathCmd = iota
	LineTo
	QuadCurveTo
	CubicCurveTo
	ArcTo
	Close
)

type PathStorage struct {
	commands []PathCmd
	vertices []float64
	x, y     float64
}

func NewPathStorage() (p *PathStorage) {
	p = new(PathStorage)
	p.commands = make([]PathCmd, 0, 256)
	p.vertices = make([]float64, 0, 256)
	return
}

func (p *PathStorage) Clear() {
	p.commands = p.commands[0:0]
	p.vertices = p.vertices[0:0]
	return
}

func (p *PathStorage) appendToPath(cmd PathCmd, vertices ...float64) {
	if cap(p.vertices) <= len(p.vertices)+6 {
		a := make([]PathCmd, len(p.commands), cap(p.commands)+256)
		b := make([]float64, len(p.vertices), cap(p.vertices)+256)
		copy(a, p.commands)
		p.commands = a
		copy(b, p.vertices)
		p.vertices = b
	}
	p.commands = p.commands[0 : len(p.commands)+1]
	p.commands[len(p.commands)-1] = cmd
	copy(p.vertices[len(p.vertices):len(p.vertices)+len(vertices)], vertices)
	p.vertices = p.vertices[0 : len(p.vertices)+len(vertices)]
}

func (src *PathStorage) Copy() (dest *PathStorage) {
	dest = new(PathStorage)
	dest.commands = make([]PathCmd, len(src.commands))
	copy(dest.commands, src.commands)
	dest.vertices = make([]float64, len(src.vertices))
	copy(dest.vertices, src.vertices)
	return dest
}

func (p *PathStorage) LastPoint() (x, y float64) {
	return p.x, p.y
}

func (p *PathStorage) IsEmpty() bool {
	return len(p.commands) == 0
}

func (p *PathStorage) Close() *PathStorage {
	p.appendToPath(Close)
	return p
}

func (p *PathStorage) MoveTo(x, y float64) *PathStorage {
	p.appendToPath(MoveTo, x, y)
	p.x = x
	p.y = y
	return p
}

func (p *PathStorage) RMoveTo(dx, dy float64) *PathStorage {
	x, y := p.LastPoint()
	p.MoveTo(x+dx, y+dy)
	return p
}

func (p *PathStorage) LineTo(x, y float64) *PathStorage {
	p.appendToPath(LineTo, x, y)
	p.x = x
	p.y = y
	return p
}

func (p *PathStorage) RLineTo(dx, dy float64) *PathStorage {
	x, y := p.LastPoint()
	p.LineTo(x+dx, y+dy)
	return p
}

func (p *PathStorage) QuadCurveTo(cx, cy, x, y float64) *PathStorage {
	p.appendToPath(QuadCurveTo, cx, cy, x, y)
	p.x = x
	p.y = y
	return p
}

func (p *PathStorage) RQuadCurveTo(dcx, dcy, dx, dy float64) *PathStorage {
	x, y := p.LastPoint()
	p.QuadCurveTo(x+dcx, y+dcy, x+dx, y+dy)
	return p
}

func (p *PathStorage) CubicCurveTo(cx1, cy1, cx2, cy2, x, y float64) *PathStorage {
	p.appendToPath(CubicCurveTo, cx1, cy1, cx2, cy2, x, y)
	p.x = x
	p.y = y
	return p
}

func (p *PathStorage) RCubicCurveTo(dcx1, dcy1, dcx2, dcy2, dx, dy float64) *PathStorage {
	x, y := p.LastPoint()
	p.CubicCurveTo(x+dcx1, y+dcy1, x+dcx2, y+dcy2, x+dx, y+dy)
	return p
}

func (p *PathStorage) ArcTo(cx, cy, rx, ry, startAngle, angle float64) *PathStorage {
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
	if len(p.commands) > 0 {
		p.LineTo(startX, startY)
	} else {
		p.MoveTo(startX, startY)
	}
	p.appendToPath(ArcTo, cx, cy, rx, ry, startAngle, angle)
	p.x = cx + math.Cos(endAngle)*rx
	p.y = cy + math.Sin(endAngle)*ry
	return p
}

func (p *PathStorage) RArcTo(dcx, dcy, rx, ry, startAngle, angle float64) *PathStorage {
	x, y := p.LastPoint()
	p.ArcTo(x+dcx, y+dcy, rx, ry, startAngle, angle)
	return p
}

func (p *PathStorage) String() string {
	s := ""
	j := 0
	for _, cmd := range p.commands {
		switch cmd {
		case MoveTo:
			s += fmt.Sprintf("MoveTo: %f, %f\n", p.vertices[j], p.vertices[j+1])
			j = j + 2
		case LineTo:
			s += fmt.Sprintf("LineTo: %f, %f\n", p.vertices[j], p.vertices[j+1])
			j = j + 2
		case QuadCurveTo:
			s += fmt.Sprintf("QuadCurveTo: %f, %f, %f, %f\n", p.vertices[j], p.vertices[j+1], p.vertices[j+2], p.vertices[j+3])
			j = j + 4
		case CubicCurveTo:
			s += fmt.Sprintf("CubicCurveTo: %f, %f, %f, %f, %f, %f\n", p.vertices[j], p.vertices[j+1], p.vertices[j+2], p.vertices[j+3], p.vertices[j+4], p.vertices[j+5])
			j = j + 6
		case ArcTo:
			s += fmt.Sprintf("ArcTo: %f, %f, %f, %f, %f, %f\n", p.vertices[j], p.vertices[j+1], p.vertices[j+2], p.vertices[j+3], p.vertices[j+4], p.vertices[j+5])
			j = j + 6
		case Close:
			s += "Close\n"
		}
	}
	return s
}
