/*
Package svg generates SVG as defined by the Scalable Vector Graphics 1.1 Specification (<http://www.w3.org/TR/SVG11/>).
Output goes to the specified io.Writer.

Supported SVG elements and functions

Shapes, lines, text

 circle, ellipse, polygon, polyline, rect (including roundrects), line, text

Paths

 general, arc, cubic and quadratic bezier paths,

Image and Gradients

 image, linearGradient, radialGradient,

Transforms

 translate, rotate, scale, skewX, skewY

Filter Effects

 filter, feBlend, feColorMatrix, feColorMatrix, feComponentTransfer, feComposite, feConvolveMatrix, feDiffuseLighting,
 feDisplacementMap, feDistantLight, feFlood, feGaussianBlur, feImage, feMerge, feMorphology, feOffset, fePointLight,
 feSpecularLighting, feSpotLight,feTile, feTurbulence


Metadata elements

 desc, defs, g (style, transform, id), mask, marker, pattern, title, (a)ddress, link, script, use

Usage: (assuming GOPATH is set)

	go get github.com/ajstarks/svgo
	go install github.com/ajstarks/svgo/...


You can use godoc to browse the documentation from the command line:

	$ godoc github.com/ajstarks/svgo


a minimal program, to generate SVG to standard output.

	package main

	import (
		"github.com/ajstarks/svgo"
		"os"
	)

	func main() {
		width := 500
		height := 500
		canvas := svg.New(os.Stdout)
		canvas.Start(width, height)
		canvas.Circle(width/2, height/2, 100)
		canvas.Text(width/2, height/2, "Hello, SVG", "text-anchor:middle;font-size:30px;fill:white")
		canvas.End()
	}

Drawing in a web server: (http://localhost:2003/circle)

	package main

	import (
		"log"
		"github.com/ajstarks/svgo"
		"net/http"
	)

	func main() {
		http.Handle("/circle", http.HandlerFunc(circle))
		err := http.ListenAndServe(":2003", nil)
		if err != nil {
			log.Fatal("ListenAndServe:", err)
		}
	}

	func circle(w http.ResponseWriter, req *http.Request) {
	  w.Header().Set("Content-Type", "image/svg+xml")
	  s := svg.New(w)
	  s.Start(500, 500)
	  s.Circle(250, 250, 125, "fill:none;stroke:black")
	  s.End()
	}

Functions and types

Many functions use x, y to specify an object's location, and w, h to specify the object's width and height.
Where applicable, a final optional argument specifies the style to be applied to the object.
The style strings follow the SVG standard; name:value pairs delimited by semicolons, or a
series of name="value" pairs. For example: `"fill:none; opacity:0.3"` or  `fill="none" opacity="0.3"` (see: <http://www.w3.org/TR/SVG11/styling.html>)

The Offcolor type:

	type Offcolor struct {
		Offset  uint8
		Color   string
		Opacity float
	}

is used to specify the offset, color, and opacity of stop colors in linear and radial gradients

The Filterspec type:

	type Filterspec struct {
		In string
		In2 string
		Result string
	}

is used to specify inputs and results for filter effects

*/
package svg
