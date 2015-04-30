// Copyright 2010 The draw2d Authors. All rights reserved.
// created: 13/12/2010 by Laurent Le Goff

package draw2d

import (
	"bosun.org/_third_party/code.google.com/p/freetype-go/freetype/raster"
)

type VertexAdder struct {
	command VertexCommand
	adder   raster.Adder
}

func NewVertexAdder(adder raster.Adder) *VertexAdder {
	return &VertexAdder{VertexNoCommand, adder}
}

func (vertexAdder *VertexAdder) NextCommand(cmd VertexCommand) {
	vertexAdder.command = cmd
}

func (vertexAdder *VertexAdder) Vertex(x, y float64) {
	switch vertexAdder.command {
	case VertexStartCommand:
		vertexAdder.adder.Start(raster.Point{raster.Fix32(x * 256), raster.Fix32(y * 256)})
	default:
		vertexAdder.adder.Add1(raster.Point{raster.Fix32(x * 256), raster.Fix32(y * 256)})
	}
	vertexAdder.command = VertexNoCommand
}

type PathAdder struct {
	adder              raster.Adder
	firstPoint         raster.Point
	ApproximationScale float64
}

func NewPathAdder(adder raster.Adder) *PathAdder {
	return &PathAdder{adder, raster.Point{0, 0}, 1}
}

func (pathAdder *PathAdder) Convert(paths ...*PathStorage) {
	for _, path := range paths {
		j := 0
		for _, cmd := range path.commands {
			switch cmd {
			case MoveTo:
				pathAdder.firstPoint = raster.Point{raster.Fix32(path.vertices[j] * 256), raster.Fix32(path.vertices[j+1] * 256)}
				pathAdder.adder.Start(pathAdder.firstPoint)
				j += 2
			case LineTo:
				pathAdder.adder.Add1(raster.Point{raster.Fix32(path.vertices[j] * 256), raster.Fix32(path.vertices[j+1] * 256)})
				j += 2
			case QuadCurveTo:
				pathAdder.adder.Add2(raster.Point{raster.Fix32(path.vertices[j] * 256), raster.Fix32(path.vertices[j+1] * 256)}, raster.Point{raster.Fix32(path.vertices[j+2] * 256), raster.Fix32(path.vertices[j+3] * 256)})
				j += 4
			case CubicCurveTo:
				pathAdder.adder.Add3(raster.Point{raster.Fix32(path.vertices[j] * 256), raster.Fix32(path.vertices[j+1] * 256)}, raster.Point{raster.Fix32(path.vertices[j+2] * 256), raster.Fix32(path.vertices[j+3] * 256)}, raster.Point{raster.Fix32(path.vertices[j+4] * 256), raster.Fix32(path.vertices[j+5] * 256)})
				j += 6
			case ArcTo:
				lastPoint := arcAdder(pathAdder.adder, path.vertices[j], path.vertices[j+1], path.vertices[j+2], path.vertices[j+3], path.vertices[j+4], path.vertices[j+5], pathAdder.ApproximationScale)
				pathAdder.adder.Add1(lastPoint)
				j += 6
			case Close:
				pathAdder.adder.Add1(pathAdder.firstPoint)
			}
		}
	}
}
