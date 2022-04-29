package errutil

import (
	"bytes"
	"fmt"
	"text/template"
)

// Template is an alternative to Base for certain advanced use-cases.
type Template struct {
	Base     Base
	template *template.Template
}

// TemplateData contains data for constructing an Error based on a
// Template.
type TemplateData struct {
	Private map[string]interface{}
	Public  map[string]interface{}
	Error   error
}

// NewTemplate creates a base error based on an text/template template.
// This is useful where the public payload is populated with fields that
// should be present in the internal error representation.
//
// Use NewBase instead if that does not match your use-case.
func NewTemplate(reason StatusReason, msgID string, t string) (Template, error) {
	tmpl, err := template.New(msgID).Parse(t)
	if err != nil {
		return Template{}, err
	}

	return Template{
		Base:     NewBase(reason, msgID),
		template: tmpl,
	}, nil
}

// MustTemplate panics if the template cannot be compiled.
//
// Only useful for global or package level initialization of error
// Template:s.
func MustTemplate(reason StatusReason, msgID string, t string) Template {
	res, err := NewTemplate(reason, msgID, t)
	if err != nil {
		panic(err)
	}

	return res
}

// Build returns a new Error based on the base Template and the provided
// TemplateData, embedding the error in TemplateData.Error if set.
//
// Build can fail and return an error that is not of type Error.
func (t Template) Build(data TemplateData) error {
	if t.template == nil {
		return fmt.Errorf("cannot initialize error using missing template")
	}

	buf := bytes.Buffer{}

	err := t.template.Execute(&buf, data)
	if err != nil {
		return err
	}

	return Error{
		Reason:        t.Base.Reason,
		MessageID:     t.Base.MessageID,
		LogMessage:    buf.String(),
		Underlying:    data.Error,
		PublicPayload: data.Public,
	}
}
