package codegen

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"path"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"text/template"

	"cuelang.org/go/cue/cuecontext"
	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/kindsys"
	"github.com/grafana/thema/encoding/jsonschema"
	"github.com/olekukonko/tablewriter"
	"github.com/xeipuuv/gojsonpointer"
)

func DocsJenny(docsPath string) OneToOne {
	return docsJenny{
		docsPath: docsPath,
	}
}

type docsJenny struct {
	docsPath string
}

func (j docsJenny) JennyName() string {
	return "DocsJenny"
}

func (j docsJenny) Generate(kind kindsys.Kind) (*codejen.File, error) {
	// TODO remove this once codejen catches nils https://github.com/grafana/codejen/issues/5
	if kind == nil {
		return nil, nil
	}

	f, err := jsonschema.GenerateSchema(kind.Lineage().Latest())
	if err != nil {
		return nil, fmt.Errorf("failed to generate json representation for the schema: %v", err)
	}
	b, err := cuecontext.New().BuildFile(f).MarshalJSON()
	if err != nil {
		return nil, fmt.Errorf("failed to marshal schema value to json: %v", err)
	}

	// We don't need entire json obj, only the value of components.schemas path
	var obj struct {
		Info struct {
			Title string
		}
		Components struct {
			Schemas json.RawMessage
		}
	}
	dec := json.NewDecoder(bytes.NewReader(b))
	dec.UseNumber()
	err = dec.Decode(&obj)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal schema json: %v", err)
	}

	// fixes the references between the types within a json after making components.schema.<types> the root of the json
	kindJsonStr := strings.Replace(string(obj.Components.Schemas), "#/components/schemas/", "#/", -1)

	kindProps := kind.Props().Common()
	data := templateData{
		KindName:        kindProps.Name,
		KindVersion:     kind.Lineage().Latest().Version().String(),
		KindMaturity:    fmt.Sprintf("[%s](../../../maturity/#%[1]s)", kindProps.Maturity),
		KindDescription: kindProps.Description,
		Markdown:        "{{ .Markdown }}",
	}

	tmpl, err := makeTemplate(data, "docs.tmpl")
	if err != nil {
		return nil, err
	}

	doc, err := jsonToMarkdown([]byte(kindJsonStr), string(tmpl), obj.Info.Title)
	if err != nil {
		return nil, fmt.Errorf("failed to build markdown for kind %s: %v", kindProps.Name, err)
	}

	return codejen.NewFile(filepath.Join(j.docsPath, strings.ToLower(kindProps.Name), "schema-reference.md"), doc, j), nil
}

// makeTemplate pre-populates the template with the kind metadata
func makeTemplate(data templateData, tmpl string) ([]byte, error) {
	buf := new(bytes.Buffer)
	if err := tmpls.Lookup(tmpl).Execute(buf, data); err != nil {
		return []byte{}, fmt.Errorf("failed to populate docs template with the kind metadata")
	}
	return buf.Bytes(), nil
}

type templateData struct {
	KindName        string
	KindVersion     string
	KindMaturity    string
	KindDescription string
	Markdown        string
}

// -------------------- JSON to Markdown conversion --------------------
// Copied from https://github.com/marcusolsson/json-schema-docs and slightly changed to fit the DocsJenny
type constraints struct {
	Pattern          string      `json:"pattern"`
	Maximum          json.Number `json:"maximum"`
	ExclusiveMinimum bool        `json:"exclusiveMinimum"`
	Minimum          json.Number `json:"minimum"`
	ExclusiveMaximum bool        `json:"exclusiveMaximum"`
	MinLength        uint        `json:"minLength"`
	MaxLength        uint        `json:"maxLength"`
}

type schema struct {
	constraints
	ID                   string             `json:"$id,omitempty"`
	Ref                  string             `json:"$ref,omitempty"`
	Schema               string             `json:"$schema,omitempty"`
	Title                string             `json:"title,omitempty"`
	Description          string             `json:"description,omitempty"`
	Required             []string           `json:"required,omitempty"`
	Type                 PropertyTypes      `json:"type,omitempty"`
	Properties           map[string]*schema `json:"properties,omitempty"`
	Items                *schema            `json:"items,omitempty"`
	Definitions          map[string]*schema `json:"definitions,omitempty"`
	Enum                 []Any              `json:"enum"`
	Default              any                `json:"default"`
	AllOf                []*schema          `json:"allOf"`
	OneOf                []*schema          `json:"oneOf"`
	AdditionalProperties *schema            `json:"additionalProperties"`
	extends              []string           `json:"-"`
	inheritedFrom        string             `json:"-"`
}

func renderMapType(props *schema) string {
	if props == nil {
		return ""
	}

	if props.Type.HasType(PropertyTypeObject) {
		name, anchor := propNameAndAnchor(props.Title, props.Title)
		return fmt.Sprintf("[%s](#%s)", name, anchor)
	}

	if props.AdditionalProperties != nil {
		return "map[string]" + renderMapType(props.AdditionalProperties)
	}

	if props.Items != nil {
		return "[]" + renderMapType(props.Items)
	}

	var types []string
	for _, t := range props.Type {
		types = append(types, string(t))
	}
	return strings.Join(types, ", ")
}

func jsonToMarkdown(jsonData []byte, tpl string, kindName string) ([]byte, error) {
	sch, err := newSchema(jsonData, kindName)
	if err != nil {
		return []byte{}, err
	}

	t, err := template.New("markdown").Parse(tpl)
	if err != nil {
		return []byte{}, err
	}

	buf := new(bytes.Buffer)
	err = t.Execute(buf, sch)
	if err != nil {
		return []byte{}, err
	}

	return buf.Bytes(), nil
}

func newSchema(b []byte, kindName string) (*schema, error) {
	var data map[string]*schema
	if err := json.Unmarshal(b, &data); err != nil {
		return nil, err
	}

	// Needed for resolving in-schema references.
	root, err := simplejson.NewJson(b)
	if err != nil {
		return nil, err
	}

	return resolveSchema(data[kindName], root)
}

// resolveSchema recursively resolves schemas.
func resolveSchema(schem *schema, root *simplejson.Json) (*schema, error) {
	for _, prop := range schem.Properties {
		if prop.Ref != "" {
			tmp, err := resolveReference(prop.Ref, root)
			if err != nil {
				return nil, err
			}
			*prop = *tmp
		}
		foo, err := resolveSchema(prop, root)
		if err != nil {
			return nil, err
		}
		*prop = *foo
	}

	if schem.Items != nil {
		if schem.Items.Ref != "" {
			tmp, err := resolveReference(schem.Items.Ref, root)
			if err != nil {
				return nil, err
			}
			*schem.Items = *tmp
		}
		foo, err := resolveSchema(schem.Items, root)
		if err != nil {
			return nil, err
		}
		*schem.Items = *foo
	}

	if len(schem.AllOf) > 0 {
		for idx, child := range schem.AllOf {
			tmp, err := resolveSubSchema(schem, child, root)
			if err != nil {
				return nil, err
			}
			schem.AllOf[idx] = tmp

			if len(tmp.Title) > 0 {
				schem.extends = append(schem.extends, tmp.Title)
			}
		}
	}

	if len(schem.OneOf) > 0 {
		for idx, child := range schem.OneOf {
			tmp, err := resolveSubSchema(schem, child, root)
			if err != nil {
				return nil, err
			}
			schem.OneOf[idx] = tmp
		}
	}

	if schem.AdditionalProperties != nil {
		if schem.AdditionalProperties.Ref != "" {
			tmp, err := resolveReference(schem.AdditionalProperties.Ref, root)
			if err != nil {
				return nil, err
			}
			*schem.AdditionalProperties = *tmp
		}
		foo, err := resolveSchema(schem.AdditionalProperties, root)
		if err != nil {
			return nil, err
		}
		*schem.AdditionalProperties = *foo
	}

	return schem, nil
}

func resolveSubSchema(parent, child *schema, root *simplejson.Json) (*schema, error) {
	if child.Ref != "" {
		tmp, err := resolveReference(child.Ref, root)
		if err != nil {
			return nil, err
		}
		*child = *tmp
	}

	if len(child.Required) > 0 {
		parent.Required = append(parent.Required, child.Required...)
	}

	child, err := resolveSchema(child, root)
	if err != nil {
		return nil, err
	}

	if parent.Properties == nil {
		parent.Properties = make(map[string]*schema)
	}

	for k, v := range child.Properties {
		prop := *v
		prop.inheritedFrom = child.Title
		parent.Properties[k] = &prop
	}

	return child, err
}

// resolveReference loads a schema from a $ref.
// If ref contains a hashtag (#), the part after represents a in-schema reference.
func resolveReference(ref string, root *simplejson.Json) (*schema, error) {
	i := strings.Index(ref, "#")

	if i != 0 {
		return nil, fmt.Errorf("not in-schema reference: %s", ref)
	}
	return resolveInSchemaReference(ref[i+1:], root)
}

func resolveInSchemaReference(ref string, root *simplejson.Json) (*schema, error) {
	// in-schema reference
	pointer, err := gojsonpointer.NewJsonPointer(ref)
	if err != nil {
		return nil, err
	}

	v, _, err := pointer.Get(root.MustMap())
	if err != nil {
		return nil, err
	}

	var sch schema
	b, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(b, &sch); err != nil {
		return nil, err
	}

	// Set the ref name as title
	sch.Title = path.Base(ref)

	return &sch, nil
}

type mdSection struct {
	title       string
	extends     string
	description string
	rows        [][]string
}

func (md mdSection) write(w io.Writer) {
	if md.title != "" {
		fmt.Fprintf(w, "### %s\n", strings.Title(md.title))
		fmt.Fprintln(w)
	}

	if md.description != "" {
		fmt.Fprintln(w, md.description)
		fmt.Fprintln(w)
	}

	if md.extends != "" {
		fmt.Fprintln(w, md.extends)
		fmt.Fprintln(w)
	}

	table := tablewriter.NewWriter(w)
	table.SetHeader([]string{"Property", "Type", "Required", "Description"})
	table.SetBorders(tablewriter.Border{Left: true, Top: false, Right: true, Bottom: false})
	table.SetCenterSeparator("|")
	table.SetAutoFormatHeaders(false)
	table.SetHeaderAlignment(tablewriter.ALIGN_LEFT)
	table.SetAutoWrapText(false)
	table.AppendBulk(md.rows)
	table.Render()
	fmt.Fprintln(w)
}

// Markdown returns the Markdown representation of the schema.
//
// The level argument can be used to offset the heading levels. This can be
// useful if you want to add the schema under a subheading.
func (s *schema) Markdown() string {
	buf := new(bytes.Buffer)

	for _, v := range s.sections() {
		v.write(buf)
	}

	return buf.String()
}

func (s *schema) sections() []mdSection {
	md := mdSection{}

	if s.AdditionalProperties == nil {
		md.title = s.Title
	}
	md.description = s.Description

	if len(s.extends) > 0 {
		md.extends = makeExtends(s.extends)
	}
	md.rows = makeRows(s)

	sections := []mdSection{md}
	for _, sch := range findDefinitions(s) {
		for _, ss := range sch.sections() {
			if !contains(sections, ss) {
				sections = append(sections, ss)
			}
		}
	}

	return sections
}

func contains(sl []mdSection, elem mdSection) bool {
	for _, s := range sl {
		if reflect.DeepEqual(s, elem) {
			return true
		}
	}
	return false
}

func makeExtends(from []string) string {
	fromLinks := make([]string, 0, len(from))
	for _, f := range from {
		fromLinks = append(fromLinks, fmt.Sprintf("[%s](#%s)", f, strings.ToLower(f)))
	}

	return fmt.Sprintf("It extends %s.", strings.Join(fromLinks, " and "))
}

func findDefinitions(s *schema) []*schema {
	// Gather all properties of object type so that we can generate the
	// properties for them recursively.
	var objs []*schema

	definition := func(k string, p *schema) {
		if p.Type.HasType(PropertyTypeObject) && p.AdditionalProperties == nil {
			// Use the identifier as the title.
			if len(p.Title) == 0 {
				p.Title = k
			}
			objs = append(objs, p)
		}

		// If the property is an array of objects, use the name of the array
		// property as the title.
		if p.Type.HasType(PropertyTypeArray) {
			if p.Items != nil {
				if p.Items.Type.HasType(PropertyTypeObject) {
					if len(p.Items.Title) == 0 {
						p.Items.Title = k
					}
					objs = append(objs, p.Items)
				}
			}
		}
	}

	for k, p := range s.Properties {
		// If a property has AdditionalProperties, then it's a map
		if p.AdditionalProperties != nil {
			definition(k, p.AdditionalProperties)
		}

		definition(k, p)
	}

	// This code could probably be unified with the one above
	for _, child := range s.AllOf {
		if child.Type.HasType(PropertyTypeObject) {
			objs = append(objs, child)
		}

		if child.Type.HasType(PropertyTypeArray) {
			if child.Items != nil {
				if child.Items.Type.HasType(PropertyTypeObject) {
					objs = append(objs, child.Items)
				}
			}
		}
	}

	for _, child := range s.OneOf {
		if child.Type.HasType(PropertyTypeObject) {
			objs = append(objs, child)
		}

		if child.Type.HasType(PropertyTypeArray) {
			if child.Items != nil {
				if child.Items.Type.HasType(PropertyTypeObject) {
					objs = append(objs, child.Items)
				}
			}
		}
	}

	// Sort the object schemas.
	sort.Slice(objs, func(i, j int) bool {
		return objs[i].Title < objs[j].Title
	})

	return objs
}

func makeRows(s *schema) [][]string {
	// Buffer all property rows so that we can sort them before printing them.
	rows := make([][]string, 0, len(s.Properties))

	var typeStr string
	if len(s.OneOf) > 0 {
		typeStr = enumStr(s)
		rows = append(rows, []string{"`object`", typeStr, "", ""})
		return rows
	}

	for key, p := range s.Properties {
		alias := propTypeAlias(p)

		if alias != "" {
			typeStr = alias
		} else {
			typeStr = propTypeStr(key, p)
		}

		// Emphasize required properties.
		var required string
		if in(s.Required, key) {
			required = "**Yes**"
		} else {
			required = "No"
		}

		var desc string
		if p.inheritedFrom != "" {
			desc = fmt.Sprintf("*(Inherited from [%s](#%s))*", p.inheritedFrom, strings.ToLower(p.inheritedFrom))
		}

		if p.Description != "" {
			desc += "\n" + p.Description
		}

		if len(p.Enum) > 0 {
			vals := make([]string, 0, len(p.Enum))
			for _, e := range p.Enum {
				vals = append(vals, e.String())
			}
			desc += "\nPossible values are: `" + strings.Join(vals, "`, `") + "`."
		}

		if p.Default != nil {
			desc += fmt.Sprintf(" Default: `%v`.", p.Default)
		}

		// Render a constraint only if it's not a type alias https://cuelang.org/docs/references/spec/#predeclared-identifiers
		if alias == "" {
			desc += constraintDescr(p)
		}
		rows = append(rows, []string{fmt.Sprintf("`%s`", key), typeStr, required, formatForTable(desc)})
	}

	// Sort by the required column, then by the name column.
	sort.Slice(rows, func(i, j int) bool {
		if rows[i][2] < rows[j][2] {
			return true
		}
		if rows[i][2] > rows[j][2] {
			return false
		}
		return rows[i][0] < rows[j][0]
	})
	return rows
}

func propTypeAlias(prop *schema) string {
	if prop.Minimum == "" || prop.Maximum == "" {
		return ""
	}

	min := prop.Minimum
	max := prop.Maximum

	switch {
	case min == "0" && max == "255":
		return "uint8"
	case min == "0" && max == "65535":
		return "uint16"
	case min == "0" && max == "4294967295":
		return "uint32"
	case min == "0" && max == "18446744073709551615":
		return "uint64"
	case min == "-128" && max == "127":
		return "int8"
	case min == "-32768" && max == "32767":
		return "int16"
	case min == "-2147483648" && max == "2147483647":
		return "int32"
	case min == "-9223372036854775808" && max == "9223372036854775807":
		return "int64"
	default:
		return ""
	}
}

func constraintDescr(prop *schema) string {
	if prop.Minimum != "" && prop.Maximum != "" {
		var left, right string
		if prop.ExclusiveMinimum {
			left = ">" + prop.Minimum.String()
		} else {
			left = ">=" + prop.Minimum.String()
		}

		if prop.ExclusiveMaximum {
			right = "<" + prop.Maximum.String()
		} else {
			right = "<=" + prop.Maximum.String()
		}
		return fmt.Sprintf("\nConstraint: `%s & %s`.", left, right)
	}

	if prop.MinLength > 0 {
		left := fmt.Sprintf(">=%v", prop.MinLength)
		right := ""

		if prop.MaxLength > 0 {
			right = fmt.Sprintf(" && <=%v", prop.MaxLength)
		}
		return fmt.Sprintf("\nConstraint: `length %s`.", left+right)
	}

	if prop.Pattern != "" {
		return fmt.Sprintf("\nConstraint: must match `%s`.", prop.Pattern)
	}

	return ""
}

func enumStr(propValue *schema) string {
	var vals []string
	for _, v := range propValue.OneOf {
		vals = append(vals, fmt.Sprintf("[%s](#%s)", v.Title, strings.ToLower(v.Title)))
	}
	return "Possible types are: " + strings.Join(vals, ", ") + "."
}

func propTypeStr(propName string, propValue *schema) string {
	// If the property has AdditionalProperties, it is most likely a map type
	if propValue.AdditionalProperties != nil {
		mapValue := renderMapType(propValue.AdditionalProperties)
		return "map[string]" + mapValue
	}

	propType := make([]string, 0, len(propValue.Type))
	// Generate relative links for objects and arrays of objects.
	for _, pt := range propValue.Type {
		switch pt {
		case PropertyTypeObject:
			name, anchor := propNameAndAnchor(propName, propValue.Title)
			propType = append(propType, fmt.Sprintf("[%s](#%s)", name, anchor))
		case PropertyTypeArray:
			if propValue.Items != nil {
				for _, pi := range propValue.Items.Type {
					if pi == PropertyTypeObject {
						name, anchor := propNameAndAnchor(propName, propValue.Items.Title)
						propType = append(propType, fmt.Sprintf("[%s](#%s)[]", name, anchor))
					} else {
						propType = append(propType, fmt.Sprintf("%s[]", pi))
					}
				}
			} else {
				propType = append(propType, string(pt))
			}
		default:
			propType = append(propType, string(pt))
		}
	}

	if len(propType) == 0 {
		return ""
	}

	if len(propType) == 1 {
		return propType[0]
	}

	if len(propType) == 2 {
		return strings.Join(propType, " or ")
	}

	return fmt.Sprintf("%s, or %s", strings.Join(propType[:len(propType)-1], ", "), propType[len(propType)-1])
}

func propNameAndAnchor(prop, title string) (string, string) {
	if len(title) > 0 {
		return title, strings.ToLower(title)
	}
	return string(PropertyTypeObject), strings.ToLower(prop)
}

// in returns true if a string slice contains a specific string.
func in(strs []string, str string) bool {
	for _, s := range strs {
		if s == str {
			return true
		}
	}
	return false
}

// formatForTable returns string usable in a Markdown table.
// It trims white spaces, replaces new lines and pipe characters.
func formatForTable(in string) string {
	s := strings.TrimSpace(in)
	s = strings.ReplaceAll(s, "\n", "<br/>")
	s = strings.ReplaceAll(s, "|", "&#124;")
	return s
}

type PropertyTypes []PropertyType

func (pts *PropertyTypes) HasType(pt PropertyType) bool {
	for _, t := range *pts {
		if t == pt {
			return true
		}
	}
	return false
}

func (pts *PropertyTypes) UnmarshalJSON(data []byte) error {
	var value interface{}
	if err := json.Unmarshal(data, &value); err != nil {
		return err
	}

	switch val := value.(type) {
	case string:
		*pts = []PropertyType{PropertyType(val)}
		return nil
	case []interface{}:
		var pt []PropertyType
		for _, t := range val {
			s, ok := t.(string)
			if !ok {
				return errors.New("unsupported property type")
			}
			pt = append(pt, PropertyType(s))
		}
		*pts = pt
	default:
		return errors.New("unsupported property type")
	}

	return nil
}

type PropertyType string

const (
	PropertyTypeString  PropertyType = "string"
	PropertyTypeNumber  PropertyType = "number"
	PropertyTypeBoolean PropertyType = "boolean"
	PropertyTypeObject  PropertyType = "object"
	PropertyTypeArray   PropertyType = "array"
	PropertyTypeNull    PropertyType = "null"
)

type Any struct {
	value interface{}
}

func (u *Any) UnmarshalJSON(data []byte) error {
	if err := json.Unmarshal(data, &u.value); err != nil {
		return err
	}
	return nil
}

func (u *Any) String() string {
	return fmt.Sprintf("%v", u.value)
}
