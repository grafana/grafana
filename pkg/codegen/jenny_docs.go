package codegen

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"sort"
	"strings"
	"text/template"

	"cuelang.org/go/cue/cuecontext"
	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/thema/encoding/jsonschema"
	"github.com/olekukonko/tablewriter"
	"github.com/xeipuuv/gojsonpointer"
)

func DocsJenny(docsPath string) OneToOne {
	return docsJenny{docsPath: docsPath}
}

type docsJenny struct {
	docsPath string
}

func (j docsJenny) JennyName() string {
	return "DocsJenny"
}

func (j docsJenny) Generate(decl *DeclForGen) (*codejen.File, error) {
	if !decl.IsCoreStructured() {
		return nil, nil
	}

	f, err := jsonschema.GenerateSchema(decl.Lineage().Latest())
	if err != nil {
		return nil, fmt.Errorf("failed to generate json representation for the schema: %v", err)
	}
	b, err := cuecontext.New().BuildFile(f).MarshalJSON()
	if err != nil {
		return nil, fmt.Errorf("failed to marshal schema value to json: %v", err)
	}

	// We don't need entire json obj, only the value of components.schemas path
	var obj struct {
		Components struct {
			Schemas json.RawMessage
		}
	}
	err = json.Unmarshal(b, &obj)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal schema json: %v", err)
	}

	// fixes the references between the types within a json after making components.schema.<types> the root of the json
	kindJsonStr := strings.Replace(string(obj.Components.Schemas), "#/components/schemas/", "#/", -1)

	kindProps := decl.Properties.Common()
	kindName := strings.ToLower(kindProps.Name)
	data := templateData{
		KindName:     kindProps.Name,
		KindVersion:  decl.Lineage().Latest().Version().String(),
		KindMaturity: string(kindProps.Maturity),
		Markdown:     "{{ .Markdown 1 }}",
	}

	tmpl, err := makeTemplate(data, "docs.tmpl")
	if err != nil {
		return nil, err
	}

	doc, err := jsonToMarkdown([]byte(kindJsonStr), string(tmpl), kindName)
	if err != nil {
		return nil, fmt.Errorf("failed to build markdown for kind %s: %v", kindName, err)
	}

	return codejen.NewFile(filepath.Join(j.docsPath, kindName, "schema-reference.md"), doc, j), nil
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
	KindName     string
	KindVersion  string
	KindMaturity string
	Markdown     string
}

// -------------------- JSON to Markdown conversion --------------------
// Copied from https://github.com/marcusolsson/json-schema-docs and sliggtly changed to fit the DocsJenny

type schema struct {
	ID          string             `json:"$id,omitempty"`
	Ref         string             `json:"$ref,omitempty"`
	Schema      string             `json:"$schema,omitempty"`
	Title       string             `json:"title,omitempty"`
	Description string             `json:"description,omitempty"`
	Required    []string           `json:"required,omitempty"`
	Type        PropertyTypes      `json:"type,omitempty"`
	Properties  map[string]*schema `json:"properties,omitempty"`
	Items       *schema            `json:"items,omitempty"`
	Definitions map[string]*schema `json:"definitions,omitempty"`
	Enum        []Any              `json:"enum"`
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

	return schem, nil
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

func resolveInSchemaReference(path string, root *simplejson.Json) (*schema, error) {
	// in-schema reference
	pointer, err := gojsonpointer.NewJsonPointer(path)
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

	return &sch, nil
}

// Markdown returns the Markdown representation of the schema.
//
// The level argument can be used to offset the heading levels. This can be
// useful if you want to add the schema under a subheading.
func (s schema) Markdown(level int) string {
	if level < 1 {
		level = 1
	}

	var buf bytes.Buffer

	if s.Title != "" {
		fmt.Fprintln(&buf, makeHeading(s.Title, level))
		fmt.Fprintln(&buf)
	}

	if s.Description != "" {
		fmt.Fprintln(&buf, s.Description)
		fmt.Fprintln(&buf)
	}

	if len(s.Properties) > 0 {
		fmt.Fprintln(&buf, makeHeading("Properties", level+1))
		fmt.Fprintln(&buf)
	}

	printProperties(&buf, &s)

	// Add padding.
	fmt.Fprintln(&buf)

	for _, obj := range findDefinitions(&s) {
		fmt.Fprint(&buf, obj.Markdown(level+1))
	}

	return buf.String()
}

func makeHeading(heading string, level int) string {
	if level < 0 {
		return heading
	}

	if level <= 6 {
		return strings.Repeat("#", level) + " " + heading
	}

	return fmt.Sprintf("**%s**", heading)
}

func findDefinitions(s *schema) []*schema {
	// Gather all properties of object type so that we can generate the
	// properties for them recursively.
	var objs []*schema

	for k, p := range s.Properties {
		// Use the identifier as the title.
		if p.Type.HasType(PropertyTypeObject) {
			p.Title = k
			objs = append(objs, p)
		}

		// If the property is an array of objects, use the name of the array
		// property as the title.
		if p.Type.HasType(PropertyTypeArray) {
			if p.Items != nil {
				if p.Items.Type.HasType(PropertyTypeObject) {
					p.Items.Title = k
					objs = append(objs, p.Items)
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

func printProperties(w io.Writer, s *schema) {
	table := tablewriter.NewWriter(w)
	table.SetHeader([]string{"Property", "Type", "Required", "Description"})
	table.SetBorders(tablewriter.Border{Left: true, Top: false, Right: true, Bottom: false})
	table.SetCenterSeparator("|")
	table.SetAutoFormatHeaders(false)
	table.SetHeaderAlignment(tablewriter.ALIGN_LEFT)
	table.SetAutoWrapText(false)

	// Buffer all property rows so that we can sort them before printing them.
	var rows [][]string

	for k, p := range s.Properties {
		// Generate relative links for objects and arrays of objects.
		var propType []string
		for _, pt := range p.Type {
			switch pt {
			case PropertyTypeObject:
				propType = append(propType, fmt.Sprintf("[object](#%s)", strings.ToLower(k)))
			case PropertyTypeArray:
				if p.Items != nil {
					for _, pi := range p.Items.Type {
						if pi == PropertyTypeObject {
							propType = append(propType, fmt.Sprintf("[%s](#%s)[]", pi, strings.ToLower(k)))
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

		var propTypeStr string
		if len(propType) == 1 {
			propTypeStr = propType[0]
		} else if len(propType) == 2 {
			propTypeStr = strings.Join(propType, " or ")
		} else if len(propType) > 2 {
			propTypeStr = fmt.Sprintf("%s, or %s", strings.Join(propType[:len(propType)-1], ", "), propType[len(propType)-1])
		}

		// Emphasize required properties.
		var required string
		if in(s.Required, k) {
			required = "**Yes**"
		} else {
			required = "No"
		}

		desc := p.Description

		if len(p.Enum) > 0 {
			var vals []string
			for _, e := range p.Enum {
				vals = append(vals, e.String())
			}
			desc += " Possible values are: `" + strings.Join(vals, "`, `") + "`."
		}

		rows = append(rows, []string{fmt.Sprintf("`%s`", k), propTypeStr, required, strings.TrimSpace(desc)})
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

	table.AppendBulk(rows)
	table.Render()
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
