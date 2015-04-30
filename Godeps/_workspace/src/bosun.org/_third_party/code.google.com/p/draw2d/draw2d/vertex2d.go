// Copyright 2010 The draw2d Authors. All rights reserved.
// created: 21/11/2010 by Laurent Le Goff

package draw2d

type VertexCommand byte

const (
	VertexNoCommand VertexCommand = iota
	VertexStartCommand
	VertexJoinCommand
	VertexCloseCommand
	VertexStopCommand
)

type VertexConverter interface {
	NextCommand(cmd VertexCommand)
	Vertex(x, y float64)
}
