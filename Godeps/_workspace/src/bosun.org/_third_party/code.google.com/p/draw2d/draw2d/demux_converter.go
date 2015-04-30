// Copyright 2010 The draw2d Authors. All rights reserved.
// created: 13/12/2010 by Laurent Le Goff

package draw2d

type DemuxConverter struct {
	converters []VertexConverter
}

func NewDemuxConverter(converters ...VertexConverter) *DemuxConverter {
	return &DemuxConverter{converters}
}

func (dc *DemuxConverter) NextCommand(cmd VertexCommand) {
	for _, converter := range dc.converters {
		converter.NextCommand(cmd)
	}
}
func (dc *DemuxConverter) Vertex(x, y float64) {
	for _, converter := range dc.converters {
		converter.Vertex(x, y)
	}
}
