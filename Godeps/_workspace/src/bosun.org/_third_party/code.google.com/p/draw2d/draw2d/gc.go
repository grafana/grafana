// Copyright 2010 The draw2d Authors. All rights reserved.
// created: 21/11/2010 by Laurent Le Goff

package draw2d

import (
	"image"
	"image/color"
)

type FillRule int

const (
	FillRuleEvenOdd FillRule = iota
	FillRuleWinding
)

type GraphicContext interface {
	Path
	// Create a new path
	BeginPath()
	GetMatrixTransform() MatrixTransform
	SetMatrixTransform(tr MatrixTransform)
	ComposeMatrixTransform(tr MatrixTransform)
	Rotate(angle float64)
	Translate(tx, ty float64)
	Scale(sx, sy float64)
	SetStrokeColor(c color.Color)
	SetFillColor(c color.Color)
	SetFillRule(f FillRule)
	SetLineWidth(lineWidth float64)
	SetLineCap(cap Cap)
	SetLineJoin(join Join)
	SetLineDash(dash []float64, dashOffset float64)
	SetFontSize(fontSize float64)
	GetFontSize() float64
	SetFontData(fontData FontData)
	GetFontData() FontData
	DrawImage(image image.Image)
	Save()
	Restore()
	Clear()
	ClearRect(x1, y1, x2, y2 int)
	SetDPI(dpi int)
	GetDPI() int
	GetStringBounds(s string) (left, top, right, bottom float64)
	CreateStringPath(text string, x, y float64) (cursor float64)
	FillString(text string) (cursor float64)
	FillStringAt(text string, x, y float64) (cursor float64)
	StrokeString(text string) (cursor float64)
	StrokeStringAt(text string, x, y float64) (cursor float64)
	Stroke(paths ...*PathStorage)
	Fill(paths ...*PathStorage)
	FillStroke(paths ...*PathStorage)
}
