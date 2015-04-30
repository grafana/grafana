#SVGo: A Go library for SVG generation#

The library generates SVG as defined by the Scalable Vector Graphics 1.1 Specification (<http://www.w3.org/TR/SVG11/>). 
Output goes to the specified io.Writer.

## Supported SVG elements and functions ##

### Shapes, lines, text
 
 circle, ellipse, polygon, polyline, rect (including roundrects), line, text
 
### Paths 
 
 general, arc, cubic and quadratic bezier paths, 
 
### Image and Gradients
 
 image, linearGradient, radialGradient, 
 
### Transforms ###
 
 translate, rotate, scale, skewX, skewY
 
### Filter Effects 
 
 filter, feBlend, feColorMatrix, feColorMatrix, feComponentTransfer, feComposite, feConvolveMatrix, feDiffuseLighting,
 feDisplacementMap, feDistantLight, feFlood, feGaussianBlur, feImage, feMerge, feMorphology, feOffset, fePointLight,
 feSpecularLighting, feSpotLight,feTile, feTurbulence


### Metadata elements ###

 desc, defs, g (style, transform, id), marker, mask, pattern, title, (a)ddress, link, script, use

## Building and Usage ##

See svgdef.[svg|png|pdf] for a graphical view of the function calls


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

You may view the SVG output with a browser that supports SVG (tested on Chrome, Opera, Firefox and Safari), or any other SVG user-agent such as Batik Squiggle.

### Graphics Sketching with SVGo and svgplay ###

Combined with the svgplay command, SVGo can be used to "sketch" with code in a browser.  

To use svgplay and SVGo, first go to a directory with your code, and run:

	$ svgplay
	2014/06/25 22:05:28 ☠ ☠ ☠ Warning: this server allows a client connecting to 127.0.0.1:1999 to execute code on this computer ☠ ☠ ☠	
	
Next open your browser to the svgplay server you just started.
svgplay only listens on localhost, and uses port 1999 (guess which year SVG was first introduced) by default

	http://localhost:1999/

Enter your code in the textarea, and when you are ready to run press Shift--Enter.  The code will be compiled, with the results
on the right.  To update, change the code and repeat. Note that compilation errors are shown in red under the code. In order for svgplay/SVGo to work, make sure that the io.Writer specified with the New function is os.Stdout.


If you want to sketch with an existing file, enter its URL:

	http://localhost:1999/foo.go
	
![SVGplay](https://farm4.staticflickr.com/3859/14322978157_31c0114850.jpg)


### SVGo Papers and presentations  ###

* SVGo paper from SVGOpen 2011 <http://www.svgopen.org/2011/papers/34-SVGo_a_Go_Library_for_SVG_generation>

* Programming Pictures with SVGo <https://speakerdeck.com/u/ajstarks/p/programming-pictures-with-svgo>

* SVGo Workshop <https://speakerdeck.com/u/ajstarks/p/svgo-workshop>


### Tutorial Video ###

A video describing how to use the package can be seen on YouTube at <http://www.youtube.com/watch?v=ze6O2Dj5gQ4>

## Package contents ##

* svg.go:		Library
* newsvg:		Coding template command
* svgdef:	Creates a SVG representation of the API
* android:	The Android logo
* bubtrail: Bubble trails
* bulletgraph:	Bullet Graphs (via Stephen Few)
* colortab: Display SVG named colors with RGB values
* compx:  Component diagrams
* flower:	Random "flowers"
* fontcompare:	Compare two fonts
* f50:		Get 50 photos from Flickr based on a query
* fe:	Filter effects
* funnel:	Funnel from transparent circles
* gradient:	Linear and radial gradients
* html5logo:	HTML5 logo with draggable elements
* imfade:	Show image fading
* lewitt:	Version of Sol Lewitt's Wall Drawing 91
* ltr:		Layer Tennis Remixes
* marker: Test markers
* paths:		Demonstrate SVG paths
* pattern:	Test patterns
* planets:	Show the scale of the Solar system
* pmap:		Proportion maps
* randcomp:	Compare random number generators
* richter:	Gerhard Richter's 256 colors
* rl:			Random lines (port of a Processing demo)
* skewabc:		Skew ABC
* stockproduct:	Visualize product and stock prices
* svgopher:	SVGo Mascot
* svgplay: SVGo sketching server
* svgplot:		Plot data
* svgrid:	Compose SVG files in a grid
* tsg:  Twitter Search Grid
* tumblrgrid:	Tumblr picture grid
* turbulence:	Turbulence filter effect
* vismem:	Visualize data from files
* webfonts:	"Hello, World" with Google Web Fonts
* websvg:	Generate SVG as a web server


## Functions and types ##

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


### Structure, Scripting, Metadata, Transformation and Links ###

	New(w io.Writer) *SVG
  Constructor, Specify the output destination.
  
	Start(w int, h int, attributes ...string)
  begin the SVG document with the width w and height h. Optionally add additional elememts
  (such as additional namespaces or scripting events)
  <http://www.w3.org/TR/SVG11/struct.html#SVGElement>
  
	Startview(w, h, minx, miny, vw, vh int)
  begin the SVG document with the width w, height h, with a viewBox at minx, miny, vw, vh.
  <http://www.w3.org/TR/SVG11/struct.html#SVGElement>
  
	Startunit(w int, h int, unit string, ns ...string)
  begin the SVG document, with width and height in the specified units. Optionally add additional elememts
  (such as additional namespaces or scripting events)
  <http://www.w3.org/TR/SVG11/struct.html#SVGElement>

  
	Startpercent(w int, h int, ns ...string)
  begin the SVG document, with width and height in percent. Optionally add additional elememts
  (such as additional namespaces or scripting events)
  <http://www.w3.org/TR/SVG11/struct.html#SVGElement>

  
	StartviewUnit(w, h int, unit string, minx, miny, vw, vh int)
   begin the SVG document with the width w, height h, in the specified unit, with a viewBox at minx, miny, vw, vh.
  <http://www.w3.org/TR/SVG11/struct.html#SVGElement>

	End()
  end the SVG document
  
	Script(scriptype string, data ...string)
 Script defines a script with a specified type, (for example "application/javascript").
 if the first variadic argument is a link, use only the link reference.
 Otherwise, treat variadic arguments as the text of the script (marked up as CDATA).
 if no data is specified, simply close the script element.
  <http://www.w3.org/TR/SVG/script.html>
  
	Group(s ...string)
  begin a group, with arbitrary attributes
  <http://www.w3.org/TR/SVG11/struct.html#GElement>

	Gstyle(s string)
  begin a group, with the specified style.
  <http://www.w3.org/TR/SVG11/struct.html#GElement>

	Gid(s string)
   begin a group, with the specified id.

	Gtransform(s string)
  begin a group, with the specified transform, end with Gend().
  <http://www.w3.org/TR/SVG11/coords.html#TransformAttribute>

	Translate(x, y int)
  begins coordinate translation to (x,y), end with Gend().
  <http://www.w3.org/TR/SVG11/coords.html#TransformAttribute>

	Scale(n float64)
  scales the coordinate system by n, end with Gend().
  <http://www.w3.org/TR/SVG11/coords.html#TransformAttribute>
  
	ScaleXY(x, y float64)
   scales the coordinate system by x, y. End with Gend().
   <http://www.w3.org/TR/SVG11/coords.html#TransformAttribute>
   
	SkewX(a float64)
   SkewX skews the x coordinate system by angle a, end with Gend().
   <http://www.w3.org/TR/SVG11/coords.html#TransformAttribute>
   
	SkewY(a float64)
   SkewY skews the y coordinate system by angle a, end with Gend().
   <http://www.w3.org/TR/SVG11/coords.html#TransformAttribute>
   
	SkewXY(ax, ay float64)
   SkewXY skews x and y coordinate systems by ax, ay respectively, end with Gend().
   <http://www.w3.org/TR/SVG11/coords.html#TransformAttribute>

	Rotate(r float64)
  rotates the coordinate system by r degrees, end with Gend().
  <http://www.w3.org/TR/SVG11/coords.html#TransformAttribute>

	TranslateRotate(x, y int, r float64)
   translates the coordinate system to (x,y), then rotates to r degrees, end with Gend().
	
	RotateTranslate(x, y int, r float64)
   rotates the coordinate system r degrees, then translates to (x,y), end with Gend().

	Gend()
   end the group (must be paired with Gstyle, Gtransform, Gid).

	ClipPath(s ...string)
  Begin a ClipPath
  <http://www.w3.org/TR/SVG/masking.html#ClippingPaths>

	ClipEnd()
  End a ClipPath
  <http://www.w3.org/TR/SVG/masking.html#ClippingPaths>

	Def()
  begin a definition block.
  <http://www.w3.org/TR/SVG11/struct.html#DefsElement>

	DefEnd()
  end a definition block.

	Marker(id string, x, y, w, h int, s ...string)
  define a marker
  <http://www.w3.org/TR/SVG11/painting.html#MarkerElement>


	MarkerEnd()
  end a marker
  
  
	Mask(id string, x int, y int, w int, h int, s ...string)
  creates a mask with a specified id, dimension, and optional style.
  <http://www.w3.org/TR/SVG/masking.html>
  
	MaskEnd()
  ends the Mask element.


	Pattern(id string, x, y, width, height int, putype string, s ...string)
 define a Pattern with the specified dimensions, the putype can be either "user" or "obj", which sets the patternUnits
 attribute to be either userSpaceOnUse or objectBoundingBox.
 <http://www.w3.org/TR/SVG11/pservers.html#Patterns>

	Desc(s string)
  specify the text of the description.
  <http://www.w3.org/TR/SVG11/struct.html#DescElement>

	Title(s string)
  specify the text of the title.
  <http://www.w3.org/TR/SVG11/struct.html#TitleElement>

	Link(href string, title string)
  begin a link named "href", with the specified title.
  <http://www.w3.org/TR/SVG11/linking.html#Links>

	LinkEnd()
  end the link.

	Use(x int, y int, link string, s ...string)
  place the object referenced at link at the location x, y.
  <http://www.w3.org/TR/SVG11/struct.html#UseElement>

### Shapes ###

	Circle(x int, y int, r int, s ...string)
  draw a circle, centered at x,y with radius r.
  <http://www.w3.org/TR/SVG11/shapes.html#CircleElement>
  
  ![Circle](http://farm5.static.flickr.com/4144/5187953823_01a1741489_m.jpg)
  
	Ellipse(x int, y int, w int, h int, s ...string)
  draw an ellipse, centered at x,y with radii w, and h.
  <http://www.w3.org/TR/SVG11/shapes.html#EllipseElement>
  
  ![Ellipse](http://farm2.static.flickr.com/1271/5187953773_a9d1fc406c_m.jpg)
 
	Polygon(x []int, y []int, s ...string)
  draw a series of line segments using an array of x, y coordinates.
  <http://www.w3.org/TR/SVG11/shapes.html#PolygonElement>
  
  ![Polygon](http://farm2.static.flickr.com/1006/5187953873_337dc26597_m.jpg)
 
	Rect(x int, y int, w int, h int, s ...string)
  draw a rectangle with upper left-hand corner at x,y, with width w, and height h.
  <http://www.w3.org/TR/SVG11/shapes.html#RectElement>
  
  ![Rect](http://farm2.static.flickr.com/1233/5188556032_86c90e354b_m.jpg)
  
	CenterRect(x int, y int, w int, h int, s ...string)
 draw a rectangle with its center at x,y, with width w, and height h.

	Roundrect(x int, y int, w int, h int, rx int, ry int, s ...string)
  draw a rounded rectangle with upper the left-hand corner at x,y, 
  with width w, and height h. The radii for the rounded portion 
  is specified by rx (width), and ry (height).
  
  ![Roundrect](http://farm2.static.flickr.com/1275/5188556120_e2a9998fee_m.jpg)
  
	Square(x int, y int, s int, style ...string)
  draw a square with upper left corner at x,y with sides of length s.
  
  ![Square](http://farm5.static.flickr.com/4110/5187953659_54dcce242e_m.jpg)

### Paths ###

	Path(p string, s ...style)
 draw the arbitrary path as specified in p, according to the style specified in s. <http://www.w3.org/TR/SVG11/paths.html>

 
	Arc(sx int, sy int, ax int, ay int, r int, large bool, sweep bool, ex int, ey int, s ...string)
  draw an elliptical arc beginning coordinate at sx,sy, ending coordinate at ex, ey
  width and height of the arc are specified by ax, ay, the x axis rotation is r
  
  if sweep is true, then the arc will be drawn in a "positive-angle" direction (clockwise), 
  if false, the arc is drawn counterclockwise.
  
  if large is true, the arc sweep angle is greater than or equal to 180 degrees, 
  otherwise the arc sweep is less than 180 degrees.
  <http://www.w3.org/TR/SVG11/paths.html#PathDataEllipticalArcCommands>
  
   ![Arc](http://farm2.static.flickr.com/1300/5188556148_df1a176074_m.jpg)


 
	Bezier(sx int, sy int, cx int, cy int, px int, py int, ex int, ey int, s ...string)
  draw a cubic bezier curve, beginning at sx,sy, ending at ex,ey
  with control points at cx,cy and px,py.
  <http://www.w3.org/TR/SVG11/paths.html#PathDataCubicBezierCommands>
  
  ![Bezier](http://farm2.static.flickr.com/1233/5188556246_a03e67d013.jpg)


 
	Qbezier(sx int, sy int, cx int, cy int, ex int, ey int, tx int, ty int, s ...string)
  draw a quadratic bezier curve, beginning at sx, sy, ending at tx,ty
  with control points are at cx,cy, ex,ey.
  <http://www.w3.org/TR/SVG11/paths.html#PathDataQuadraticBezierCommands>
  
   ![Qbezier](http://farm2.static.flickr.com/1018/5187953917_9a43cf64fb.jpg)
  
 
	Qbez(sx int, sy int, cx int, cy int, ex int, ey int, s...string)
   draws a quadratic bezier curver, with optional style beginning at sx,sy, ending at ex, sy
   with the control point at cx, cy.
   <http://www.w3.org/TR/SVG11/paths.html#PathDataQuadraticBezierCommands>
   
   ![Qbez](http://farm6.static.flickr.com/5176/5569879349_5f726aab5e.jpg)

### Lines ###

	Line(x1 int, y1 int, x2 int, y2 int, s ...string)
  draw a line segment between x1,y1 and x2,y2.
  <http://www.w3.org/TR/SVG11/shapes.html#LineElement>
 
 ![Line](http://farm5.static.flickr.com/4154/5188556080_0be19da0bc.jpg)

 
	Polyline(x []int, y []int, s ...string)
  draw a polygon using coordinates specified in x,y arrays.
  <http://www.w3.org/TR/SVG11/shapes.html#PolylineElement>
 
 ![Polyline](http://farm2.static.flickr.com/1266/5188556384_a863273a69.jpg)

### Image and Text ###

	Image(x int, y int, w int, h int, link string, s ...string)
  place at x,y (upper left hand corner), the image with width w, and height h, referenced at link.
  <http://www.w3.org/TR/SVG11/struct.html#ImageElement>
 
 ![Image](http://farm5.static.flickr.com/4058/5188556346_e5ce3dcbc2_m.jpg)

	Text(x int, y int, t string, s ...string)
  Place the specified text, t at x,y according to the style specified in s.
  <http://www.w3.org/TR/SVG11/text.html#TextElement>
  
	Textlines(x, y int, s []string, size, spacing int, fill, align string)
 Places lines of text in s, starting at x,y, at the specified size, fill, and alignment, and spacing.
    
	Textpath(t string, pathid string, s ...string)
  places optionally styled text along a previously defined path.
  <http://www.w3.org/TR/SVG11/text.html#TextPathElement>
  ![Image](http://farm4.static.flickr.com/3149/5694580737_4b291df768_m.jpg)
  
### Color ###

	RGB(r int, g int, b int) string
  creates a style string for the fill color designated 
  by the (r)ed, g(reen), (b)lue components.
  <http://www.w3.org/TR/css3-color/>
  
	RGBA(r int, g int, b int, a float64) string
  as above, but includes the color's opacity as a value
  between 0.0 (fully transparent) and 1.0 (opaque).
  
### Gradients ###

	LinearGradient(id string, x1, y1, x2, y2 uint8, sc []Offcolor)
  constructs a linear color gradient identified by id, 
  along the vector defined by (x1,y1), and (x2,y2).
  The stop color sequence defined in sc. Coordinates are expressed as percentages.
  <http://www.w3.org/TR/SVG11/pservers.html#LinearGradients>
  ![LinearGradient](http://farm5.static.flickr.com/4153/5187954033_3972f63fa9.jpg) 
  
	RadialGradient(id string, cx, cy, r, fx, fy uint8, sc []Offcolor)
  constructs a radial color gradient identified by id, 
  centered at (cx,cy), with a radius of r.
  (fx, fy) define the location of the focal point of the light source. 
  The stop color sequence defined in sc.
  Coordinates are expressed as percentages.
  <http://www.w3.org/TR/SVG11/pservers.html#RadialGradients>
  
  ![RadialGradient](http://farm2.static.flickr.com/1302/5187954065_7ddba7b819.jpg)
  
### Filter Effects ###

	Filter(id string, s ...string)
 Filter begins a filter set
Standard reference: <http://www.w3.org/TR/SVG11/filters.html#FilterElement>

 	Fend() 
Fend ends a filter set
Standard reference: <http://www.w3.org/TR/SVG11/filters.html#FilterElement>

 	FeBlend(fs Filterspec, mode string, s ...string) 
FeBlend specifies a Blend filter primitive
Standard reference: <http://www.w3.org/TR/SVG11/filters.html#feBlendElement>

 	FeColorMatrix(fs Filterspec, values [20]float64, s ...string)	
FeColorMatrix specifies a color matrix filter primitive, with matrix values
Standard reference: <http://www.w3.org/TR/SVG11/filters.html#feColorMatrixElement>

 	FeColorMatrixHue(fs Filterspec, value float64, s ...string)  	
FeColorMatrix specifies a color matrix filter primitive, with hue values
Standard reference: <http://www.w3.org/TR/SVG11/filters.html#feColorMatrixElement>

 	FeColorMatrixSaturate(fs Filterspec, value float64, s ...string) 
FeColorMatrix specifies a color matrix filter primitive, with saturation values
Standard reference: <http://www.w3.org/TR/SVG11/filters.html#feColorMatrixElement>

 	FeColorMatrixLuminence(fs Filterspec, s ...string) 
FeColorMatrix specifies a color matrix filter primitive, with luminence values
Standard reference: <http://www.w3.org/TR/SVG11/filters.html#feColorMatrixElement> 	
 	
 	FeComponentTransfer()  	
FeComponentTransfer begins a feComponent filter Element>
Standard reference: <http://www.w3.org/TR/SVG11/filters.html#feComponentTransferElement>

 	FeCompEnd()
FeCompEnd ends a feComponent filter Element>
 
 	FeComposite(fs Filterspec, operator string, k1, k2, k3, k4 int, s ...string)
FeComposite specifies a feComposite filter primitive
Standard reference: <http://www.w3.org/TR/SVG11/filters.html#feCompositeElement>

 	FeConvolveMatrix(fs Filterspec, matrix [9]int, s ...string)
FeConvolveMatrix specifies a feConvolveMatrix filter primitive
Standard referencd: <http://www.w3.org/TR/SVG11/filters.html#feConvolveMatrixElement>


	 FeDiffuseLighting(fs Filterspec, scale, constant float64, s ...string) 
FeDiffuseLighting specifies a diffuse lighting filter primitive, 
a container for light source Element>s, end with DiffuseEnd()

	 FeDiffEnd()
FeDiffuseEnd ends a diffuse lighting filter primitive container
Standard reference: <http://www.w3.org/TR/SVG11/filters.html#feDiffuseLightingElement>


	 FeDisplacementMap(fs Filterspec, scale float64, xchannel, ychannel string, s ...string)
FeDisplacementMap specifies a feDisplacementMap filter primitive
Standard reference: <http://www.w3.org/TR/SVG11/filters.html#feDisplacementMapElement>

	 FeDistantLight(fs Filterspec, azimuth, elevation float64, s ...string)
FeDistantLight specifies a feDistantLight filter primitive
Standard reference: <http://www.w3.org/TR/SVG11/filters.html#feDistantLightElement>

	 FeFlood(fs Filterspec, color string, opacity float64, s ...string)
FeFlood specifies a flood filter primitive
Standard reference: <http://www.w3.org/TR/SVG11/filters.html#feFloodElement>

	FeFuncLinear(channel string, slope, intercept float64)
FeFuncLinear is the linear form of feFunc
Standard reference: <http://www.w3.org/TR/SVG11/filters.html#feComponentTransferElement>

	 FeFuncGamma(channel, amplitude, exponent, offset float64)
FeFuncGamma is the gamma curve form of feFunc
Standard reference: <http://www.w3.org/TR/SVG11/filters.html#feComponentTransferElement>

	FeFuncTable(channel string, tv []float64)
FeFuncGamma is the form of feFunc using a table of values
Standard reference: <http://www.w3.org/TR/SVG11/filters.html#feComponentTransferElement>
	
	FeFuncDiscrete(channel string, tv []float64)
FeFuncGamma is the form of feFunc using discrete values
Standard reference: <http://www.w3.org/TR/SVG11/filters.html#feComponentTransferElement>

	 FeGaussianBlur(fs Filterspec, stdx, stdy float64, s ...string)
FeGaussianBlur specifies a Gaussian Blur filter primitive
Standard reference: <http://www.w3.org/TR/SVG11/filters.html#feGaussianBlurElement>

	 FeImage(href string, result string, s ...string)
FeImage specifies a feImage filter primitive
Standard reference: <http://www.w3.org/TR/SVG11/filters.html#feImageElement>

	 FeMerge(nodes []string, s ...string)
FeMerge specifies a feMerge filter primitive, containing feMerge Element>s
Standard reference: <http://www.w3.org/TR/SVG11/filters.html#feMergeElement>

	 FeMorphology(fs Filterspec, operator string, xradius, yradius float64, s ...string)
FeMorphologyLight specifies a feMorphologyLight filter primitive
Standard reference: <http://www.w3.org/TR/SVG11/filters.html#feMorphologyElement>

	 FeOffset(fs Filterspec, dx, dy int, s ...string)
FeOffset specifies the feOffset filter primitive
Standard reference: <http://www.w3.org/TR/SVG11/filters.html#feOffsetElement>

	 FePointLight(x, y, z float64, s ...string)
FePointLight specifies a fePpointLight filter primitive
Standard reference: <http://www.w3.org/TR/SVG11/filters.html#fePointLightElement>

	 FeSpecularLighting(fs Filterspec, scale, constant float64, exponent int, color string, s ...string)
FeSpecularLighting specifies a specular lighting filter primitive, 
a container for light source elements, end with SpecularEnd()


	 FeSpecEnd()
FeSpecularEnd ends a specular lighting filter primitive container
Standard reference: <http://www.w3.org/TR/SVG11/filters.html#feSpecularLightingElement>


	 FeSpotLight(fs Filterspec, x, y, z, px, py, pz float64, s ...string)
FeSpotLight specifies a feSpotLight filter primitive
Standard reference: <http://www.w3.org/TR/SVG11/filters.html#feSpotLightElement>

	 FeTile(fs Filterspec, in string, s ...string)
FeTile specifies the tile utility filter primitive
Standard reference: <http://www.w3.org/TR/SVG11/filters.html#feTileElement>


	 FeTurbulence(fs Filterspec, ftype string, bfx, bfy float64, octaves int, seed int64, stitch bool, s ...string)
FeTurbulence specifies a turbulence filter primitive
Standard reference: <http://www.w3.org/TR/SVG11/filters.html#feTurbulenceElement>

### Filter convenience functions (modeled on CSS filter effects) ###

	Blur(p float64)
Blur function by standard deviation

	Brightness(p float64)
Brightness function (0-100)

	Grayscale()
Apply a grayscale filter to the image	
	
	HueRotate(a float64)
Rotate Hues (0-360 degrees)
	
	Invert()
Invert the image's colors
	
	Saturate(p float64)
Percent saturation, 0 is grayscale

	Sepia()
Apply sepia tone


### Utility ###

	Grid(x int, y int, w int, h int, n int, s ...string)
  draws a grid of straight lines starting at x,y, with a width w, and height h, and a size of n.
  
  ![Grid](http://farm5.static.flickr.com/4133/5190957924_7a31d0db34.jpg)
  
### Credits ###

Thanks to Jonathan Wright for the io.Writer update.
