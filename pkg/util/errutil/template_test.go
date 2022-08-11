package errutil_test

import (
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/util/errutil"
)

func ExampleTemplate() {
	// Initialization, this is typically done on a package or global
	// level.
	var tmpl = errutil.NewBase(errutil.StatusInternal, "template.sample-error").MustTemplate("[{{ .Public.user }}] got error: {{ .Error }}")

	// Construct an error based on the template.
	err := tmpl.Build(errutil.TemplateData{
		Public: map[string]interface{}{
			"user": "grot the bot",
		},
		Error: errors.New("oh noes"),
	})

	fmt.Println(err.Error())

	// Output:
	// [template.sample-error] [grot the bot] got error: oh noes
}

func ExampleTemplate_public() {
	// Initialization, this is typically done on a package or global
	// level.
	var tmpl = errutil.
		NewBase(errutil.StatusInternal, "template.sample-error").
		MustTemplate(
			"[{{ .Public.user }}] got error: {{ .Error }}",
			errutil.WithPublic("Oh, no, error for {{ .Public.user }}"),
		)

	// Construct an error based on the template.
	//nolint:errorlint
	err := tmpl.Build(errutil.TemplateData{
		Public: map[string]interface{}{
			"user": "grot the bot",
		},
		Error: errors.New("oh noes"),
	}).(errutil.Error)

	fmt.Println(err.Error())
	fmt.Println(err.PublicMessage)

	// Output:
	// [template.sample-error] [grot the bot] got error: oh noes
	// Oh, no, error for grot the bot
}
