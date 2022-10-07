package errutil

import (
	"bytes"
	"fmt"
	"text/template"
)

// Template is an extended Base for when using templating to construct
// error messages.
type Template struct {
	Base           Base
	logTemplate    *template.Template
	publicTemplate *template.Template
}

// TemplateData contains data for constructing an Error based on a
// Template.
type TemplateData struct {
	Private map[string]interface{}
	Public  map[string]interface{}
	Error   error
}

// Template provides templating for converting Base to Error.
// This is useful where the public payload is populated with fields that
// should be present in the internal error representation.
func (b Base) Template(pattern string, opts ...TemplateOpt) (Template, error) {
	tmpl, err := template.New(b.messageID + "~private").Parse(pattern)
	if err != nil {
		return Template{}, err
	}

	t := Template{
		Base:        b,
		logTemplate: tmpl,
	}

	for _, o := range opts {
		t, err = o(t)
		if err != nil {
			return Template{}, err
		}
	}

	return t, nil
}

type TemplateOpt func(Template) (Template, error)

// MustTemplate panics if the template for Template cannot be compiled.
//
// Only useful for global or package level initialization of [Template].
func (b Base) MustTemplate(pattern string, opts ...TemplateOpt) Template {
	res, err := b.Template(pattern, opts...)
	if err != nil {
		panic(err)
	}

	return res
}

// WithPublic provides templating for the user facing error message based
// on only the fields available in TemplateData.Public.
//
// Used as a functional option to [Base.Template].
func WithPublic(pattern string) TemplateOpt {
	return func(t Template) (Template, error) {
		var err error
		t.publicTemplate, err = template.New(t.Base.messageID + "~public").Parse(pattern)
		return t, err
	}
}

// WithPublicFromLog copies over the template for the log message to be
// used for the user facing error message.
// TemplateData.Error and TemplateData.Private will not be populated
// when rendering the public message.
//
// Used as a functional option to [Base.Template].
func WithPublicFromLog() TemplateOpt {
	return func(t Template) (Template, error) {
		t.publicTemplate = t.logTemplate
		return t, nil
	}
}

// Build returns a new [Error] based on the base [Template] and the
// provided [TemplateData], wrapping the error in TemplateData.Error.
//
// Build can fail and return an error that is not of type Error.
func (t Template) Build(data TemplateData) error {
	if t.logTemplate == nil {
		return fmt.Errorf("cannot initialize error using missing template")
	}

	buf := bytes.Buffer{}
	err := t.logTemplate.Execute(&buf, data)
	if err != nil {
		return err
	}

	pubBuf := bytes.Buffer{}
	if t.publicTemplate != nil {
		err := t.publicTemplate.Execute(&pubBuf, TemplateData{Public: data.Public})
		if err != nil {
			return err
		}
	}

	e := t.Base.Errorf("%s", buf.String())
	e.PublicMessage = pubBuf.String()
	e.PublicPayload = data.Public
	e.Underlying = data.Error

	return e
}

func (t Template) Error() string {
	return t.Base.Error()
}
