package api

import (
	"bytes"
	"fmt"
	"path"
	"regexp"
	"sort"
	"strings"
	"text/template"
)

// A ShapeRef defines the usage of a shape within the API.
type ShapeRef struct {
	API              *API   `json:"-"`
	Shape            *Shape `json:"-"`
	Documentation    string
	ShapeName        string `json:"shape"`
	Location         string
	LocationName     string
	QueryName        string
	Flattened        bool
	Streaming        bool
	XMLAttribute     bool
	XMLNamespace     XMLInfo
	Payload          string
	IdempotencyToken bool `json:"idempotencyToken"`
	Deprecated       bool `json:"deprecated"`
}

// A XMLInfo defines URL and prefix for Shapes when rendered as XML
type XMLInfo struct {
	Prefix string
	URI    string
}

// A Shape defines the definition of a shape type
type Shape struct {
	API              *API `json:"-"`
	ShapeName        string
	Documentation    string
	MemberRefs       map[string]*ShapeRef `json:"members"`
	MemberRef        ShapeRef             `json:"member"`
	KeyRef           ShapeRef             `json:"key"`
	ValueRef         ShapeRef             `json:"value"`
	Required         []string
	Payload          string
	Type             string
	Exception        bool
	Enum             []string
	EnumConsts       []string
	Flattened        bool
	Streaming        bool
	Location         string
	LocationName     string
	IdempotencyToken bool `json:"idempotencyToken"`
	XMLNamespace     XMLInfo
	Min              float64 // optional Minimum length (string, list) or value (number)
	Max              float64 // optional Maximum length (string, list) or value (number)

	refs       []*ShapeRef // References to this shape
	resolvePkg string      // use this package in the goType() if present

	// Defines if the shape is a placeholder and should not be used directly
	Placeholder bool

	Deprecated bool `json:"deprecated"`

	Validations ShapeValidations
}

// GoTags returns the struct tags for a shape.
func (s *Shape) GoTags(root, required bool) string {
	ref := &ShapeRef{ShapeName: s.ShapeName, API: s.API, Shape: s}
	return ref.GoTags(root, required)
}

// Rename changes the name of the Shape to newName. Also updates
// the associated API's reference to use newName.
func (s *Shape) Rename(newName string) {
	for _, r := range s.refs {
		r.ShapeName = newName
	}

	delete(s.API.Shapes, s.ShapeName)
	s.API.Shapes[newName] = s
	s.ShapeName = newName
}

// MemberNames returns a slice of struct member names.
func (s *Shape) MemberNames() []string {
	i, names := 0, make([]string, len(s.MemberRefs))
	for n := range s.MemberRefs {
		names[i] = n
		i++
	}
	sort.Strings(names)
	return names
}

// GoTypeWithPkgName returns a shape's type as a string with the package name in
// <packageName>.<type> format. Package naming only applies to structures.
func (s *Shape) GoTypeWithPkgName() string {
	return goType(s, true)
}

// GoStructType returns the type of a struct field based on the API
// model definition.
func (s *Shape) GoStructType(name string, ref *ShapeRef) string {
	if (ref.Streaming || ref.Shape.Streaming) && s.Payload == name {
		rtype := "io.ReadSeeker"
		if len(s.refs) > 1 {
			rtype = "aws.ReaderSeekCloser"
		} else if strings.HasSuffix(s.ShapeName, "Output") {
			rtype = "io.ReadCloser"
		}

		s.API.imports["io"] = true
		return rtype
	}

	for _, v := range s.Validations {
		// TODO move this to shape validation resolution
		if (v.Ref.Shape.Type == "map" || v.Ref.Shape.Type == "list") && v.Type == ShapeValidationNested {
			s.API.imports["fmt"] = true
		}
	}

	return ref.GoType()
}

// GoType returns a shape's Go type
func (s *Shape) GoType() string {
	return goType(s, false)
}

// GoType returns a shape ref's Go type.
func (ref *ShapeRef) GoType() string {
	if ref.Shape == nil {
		panic(fmt.Errorf("missing shape definition on reference for %#v", ref))
	}

	return ref.Shape.GoType()
}

// GoTypeWithPkgName returns a shape's type as a string with the package name in
// <packageName>.<type> format. Package naming only applies to structures.
func (ref *ShapeRef) GoTypeWithPkgName() string {
	if ref.Shape == nil {
		panic(fmt.Errorf("missing shape definition on reference for %#v", ref))
	}

	return ref.Shape.GoTypeWithPkgName()
}

// Returns a string version of the Shape's type.
// If withPkgName is true, the package name will be added as a prefix
func goType(s *Shape, withPkgName bool) string {
	switch s.Type {
	case "structure":
		if withPkgName || s.resolvePkg != "" {
			pkg := s.resolvePkg
			if pkg != "" {
				s.API.imports[pkg] = true
				pkg = path.Base(pkg)
			} else {
				pkg = s.API.PackageName()
			}
			return fmt.Sprintf("*%s.%s", pkg, s.ShapeName)
		}
		return "*" + s.ShapeName
	case "map":
		return "map[string]" + s.ValueRef.GoType()
	case "list":
		return "[]" + s.MemberRef.GoType()
	case "boolean":
		return "*bool"
	case "string", "character":
		return "*string"
	case "blob":
		return "[]byte"
	case "integer", "long":
		return "*int64"
	case "float", "double":
		return "*float64"
	case "timestamp":
		s.API.imports["time"] = true
		return "*time.Time"
	default:
		panic("Unsupported shape type: " + s.Type)
	}
}

// GoTypeElem returns the Go type for the Shape. If the shape type is a pointer just
// the type will be returned minus the pointer *.
func (s *Shape) GoTypeElem() string {
	t := s.GoType()
	if strings.HasPrefix(t, "*") {
		return t[1:]
	}
	return t
}

// GoTypeElem returns the Go type for the Shape. If the shape type is a pointer just
// the type will be returned minus the pointer *.
func (ref *ShapeRef) GoTypeElem() string {
	if ref.Shape == nil {
		panic(fmt.Errorf("missing shape definition on reference for %#v", ref))
	}

	return ref.Shape.GoTypeElem()
}

// ShapeTag is a struct tag that will be applied to a shape's generated code
type ShapeTag struct {
	Key, Val string
}

// String returns the string representation of the shape tag
func (s ShapeTag) String() string {
	return fmt.Sprintf(`%s:"%s"`, s.Key, s.Val)
}

// ShapeTags is a collection of shape tags and provides serialization of the
// tags in an ordered list.
type ShapeTags []ShapeTag

// Join returns an ordered serialization of the shape tags with the provided
// separator.
func (s ShapeTags) Join(sep string) string {
	o := &bytes.Buffer{}
	for i, t := range s {
		o.WriteString(t.String())
		if i < len(s)-1 {
			o.WriteString(sep)
		}
	}

	return o.String()
}

// String is an alias for Join with the empty space separator.
func (s ShapeTags) String() string {
	return s.Join(" ")
}

// GoTags returns the rendered tags string for the ShapeRef
func (ref *ShapeRef) GoTags(toplevel bool, isRequired bool) string {
	tags := ShapeTags{}

	if ref.Location != "" {
		tags = append(tags, ShapeTag{"location", ref.Location})
	} else if ref.Shape.Location != "" {
		tags = append(tags, ShapeTag{"location", ref.Shape.Location})
	}

	if ref.LocationName != "" {
		tags = append(tags, ShapeTag{"locationName", ref.LocationName})
	} else if ref.Shape.LocationName != "" {
		tags = append(tags, ShapeTag{"locationName", ref.Shape.LocationName})
	}

	if ref.QueryName != "" {
		tags = append(tags, ShapeTag{"queryName", ref.QueryName})
	}
	if ref.Shape.MemberRef.LocationName != "" {
		tags = append(tags, ShapeTag{"locationNameList", ref.Shape.MemberRef.LocationName})
	}
	if ref.Shape.KeyRef.LocationName != "" {
		tags = append(tags, ShapeTag{"locationNameKey", ref.Shape.KeyRef.LocationName})
	}
	if ref.Shape.ValueRef.LocationName != "" {
		tags = append(tags, ShapeTag{"locationNameValue", ref.Shape.ValueRef.LocationName})
	}
	if ref.Shape.Min > 0 {
		tags = append(tags, ShapeTag{"min", fmt.Sprintf("%v", ref.Shape.Min)})
	}

	if ref.Deprecated || ref.Shape.Deprecated {
		tags = append(tags, ShapeTag{"deprecated", "true"})
	}
	// All shapes have a type
	tags = append(tags, ShapeTag{"type", ref.Shape.Type})

	// embed the timestamp type for easier lookups
	if ref.Shape.Type == "timestamp" {
		t := ShapeTag{Key: "timestampFormat"}
		if ref.Location == "header" {
			t.Val = "rfc822"
		} else {
			switch ref.API.Metadata.Protocol {
			case "json", "rest-json":
				t.Val = "unix"
			case "rest-xml", "ec2", "query":
				t.Val = "iso8601"
			}
		}
		tags = append(tags, t)
	}

	if ref.Shape.Flattened || ref.Flattened {
		tags = append(tags, ShapeTag{"flattened", "true"})
	}
	if ref.XMLAttribute {
		tags = append(tags, ShapeTag{"xmlAttribute", "true"})
	}
	if isRequired {
		tags = append(tags, ShapeTag{"required", "true"})
	}
	if ref.Shape.IsEnum() {
		tags = append(tags, ShapeTag{"enum", ref.ShapeName})
	}

	if toplevel {
		if ref.Shape.Payload != "" {
			tags = append(tags, ShapeTag{"payload", ref.Shape.Payload})
		}
		if ref.XMLNamespace.Prefix != "" {
			tags = append(tags, ShapeTag{"xmlPrefix", ref.XMLNamespace.Prefix})
		} else if ref.Shape.XMLNamespace.Prefix != "" {
			tags = append(tags, ShapeTag{"xmlPrefix", ref.Shape.XMLNamespace.Prefix})
		}
		if ref.XMLNamespace.URI != "" {
			tags = append(tags, ShapeTag{"xmlURI", ref.XMLNamespace.URI})
		} else if ref.Shape.XMLNamespace.URI != "" {
			tags = append(tags, ShapeTag{"xmlURI", ref.Shape.XMLNamespace.URI})
		}
	}

	if ref.IdempotencyToken || ref.Shape.IdempotencyToken {
		tags = append(tags, ShapeTag{"idempotencyToken", "true"})
	}

	return fmt.Sprintf("`%s`", tags)
}

// Docstring returns the godocs formated documentation
func (ref *ShapeRef) Docstring() string {
	if ref.Documentation != "" {
		return strings.Trim(ref.Documentation, "\n ")
	}
	return ref.Shape.Docstring()
}

// Docstring returns the godocs formated documentation
func (s *Shape) Docstring() string {
	return strings.Trim(s.Documentation, "\n ")
}

var goCodeStringerTmpl = template.Must(template.New("goCodeStringerTmpl").Parse(`
// String returns the string representation
func (s {{ .ShapeName }}) String() string {
	return awsutil.Prettify(s)
}
// GoString returns the string representation
func (s {{ .ShapeName }}) GoString() string {
	return s.String()
}
`))

// GoCodeStringers renders the Stringers for API input/output shapes
func (s *Shape) GoCodeStringers() string {
	w := bytes.Buffer{}
	if err := goCodeStringerTmpl.Execute(&w, s); err != nil {
		panic(fmt.Sprintln("Unexpected error executing GoCodeStringers template", err))
	}

	return w.String()
}

var enumStrip = regexp.MustCompile(`[^a-zA-Z0-9_:\./-]`)
var enumDelims = regexp.MustCompile(`[-_:\./]+`)
var enumCamelCase = regexp.MustCompile(`([a-z])([A-Z])`)

// EnumName returns the Nth enum in the shapes Enum list
func (s *Shape) EnumName(n int) string {
	enum := s.Enum[n]
	enum = enumStrip.ReplaceAllLiteralString(enum, "")
	enum = enumCamelCase.ReplaceAllString(enum, "$1-$2")
	parts := enumDelims.Split(enum, -1)
	for i, v := range parts {
		v = strings.ToLower(v)
		parts[i] = ""
		if len(v) > 0 {
			parts[i] = strings.ToUpper(v[0:1])
		}
		if len(v) > 1 {
			parts[i] += v[1:]
		}
	}
	enum = strings.Join(parts, "")
	enum = strings.ToUpper(enum[0:1]) + enum[1:]
	return enum
}

// NestedShape returns the shape pointer value for the shape which is nested
// under the current shape. If the shape is not nested nil will be returned.
//
// strucutures, the current shape is returned
// map: the value shape of the map is returned
// list: the element shape of the list is returned
func (s *Shape) NestedShape() *Shape {
	var nestedShape *Shape
	switch s.Type {
	case "structure":
		nestedShape = s
	case "map":
		nestedShape = s.ValueRef.Shape
	case "list":
		nestedShape = s.MemberRef.Shape
	}

	return nestedShape
}

var structShapeTmpl = template.Must(template.New("StructShape").Parse(`
{{ .Docstring }}
type {{ .ShapeName }} struct {
	_ struct{} {{ .GoTags true false }}

	{{ $context := . -}}
	{{ range $_, $name := $context.MemberNames -}}
		{{ $elem := index $context.MemberRefs $name }}
		{{ $isRequired := $context.IsRequired $name }}
		{{ $elem.Docstring }}
		{{ $name }} {{ $context.GoStructType $name $elem }} {{ $elem.GoTags false $isRequired }}
	{{ end }}
}
{{ if not .API.NoStringerMethods }}
	{{ .GoCodeStringers }}
{{ end }}
{{ if not .API.NoValidataShapeMethods }}
	{{ if .Validations -}}
		{{ .Validations.GoCode . }}
	{{ end }}
{{ end }}
`))

var enumShapeTmpl = template.Must(template.New("EnumShape").Parse(`
{{ .Docstring }}
const (
	{{ $context := . -}}
	{{ range $index, $elem := .Enum -}}
		// @enum {{ $context.ShapeName }}
		{{ index $context.EnumConsts $index }} = "{{ $elem }}"
	{{ end }}
)
`))

// GoCode returns the rendered Go code for the Shape.
func (s *Shape) GoCode() string {
	b := &bytes.Buffer{}

	switch {
	case s.Type == "structure":
		if err := structShapeTmpl.Execute(b, s); err != nil {
			panic(fmt.Sprintf("Failed to generate struct shape %s, %v\n", s.ShapeName, err))
		}
	case s.IsEnum():
		if err := enumShapeTmpl.Execute(b, s); err != nil {
			panic(fmt.Sprintf("Failed to generate enum shape %s, %v\n", s.ShapeName, err))
		}
	default:
		panic(fmt.Sprintln("Cannot generate toplevel shape for", s.Type))
	}

	return b.String()
}

// IsEnum returns whether this shape is an enum list
func (s *Shape) IsEnum() bool {
	return s.Type == "string" && len(s.Enum) > 0
}

// IsRequired returns if member is a required field.
func (s *Shape) IsRequired(member string) bool {
	for _, n := range s.Required {
		if n == member {
			return true
		}
	}
	return false
}

// IsInternal returns whether the shape was defined in this package
func (s *Shape) IsInternal() bool {
	return s.resolvePkg == ""
}

// removeRef removes a shape reference from the list of references this
// shape is used in.
func (s *Shape) removeRef(ref *ShapeRef) {
	r := s.refs
	for i := 0; i < len(r); i++ {
		if r[i] == ref {
			j := i + 1
			copy(r[i:], r[j:])
			for k, n := len(r)-j+i, len(r); k < n; k++ {
				r[k] = nil // free up the end of the list
			} // for k
			s.refs = r[:len(r)-j+i]
			break
		}
	}
}
