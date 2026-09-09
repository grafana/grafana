package main

import (
	"bytes"
	"log"
	"strings"
	"testing"
	"testing/fstest"
)

func TestCommonElement(t *testing.T) {
	for _, test := range []struct {
		A      []string
		B      []string
		Result bool
	}{
		{nil, nil, false},
		{[]string{"a"}, []string{"a"}, true},
		{[]string{"a", "b"}, []string{"a"}, true},
		{[]string{"a"}, []string{"b"}, false},
	} {
		if hasCommonElement(test.A, test.B) != test.Result {
			t.Error(test)
		}
	}
}

func TestCheck(t *testing.T) {
	for _, test := range []struct {
		description    string
		fileName       string
		contents       string
		args           []string
		valid          bool
		expectedOutput string
	}{
		{"Test valid modfile", "go.mod", `
		require (
			cloud.google.com/go/storage v1.28.1 // @delivery
			cuelang.org/go v0.5.0 // @as-code @grafana/grafana-backend-group
			github.com/Azure/azure-sdk-for-go v65.0.0+incompatible // indirect, @delivery
			github.com/Masterminds/semver v1.5.0 // @delivery @grafana/grafana-backend-group
		)
		`, []string{"go.mod"}, true, ""},
		{"Test invalid modfile", "go.mod", `
		require (
			cloud.google.com/go/storage v1.28.1
			cuelang.org/go v0.5.0 // @as-code @grafana/grafana-backend-group
			github.com/Azure/azure-sdk-for-go v65.0.0+incompatible // indirect, @delivery
			github.com/Masterminds/semver v1.5.0 // @delivery @grafana/grafana-backend-group
		)
		`, []string{"go.mod"}, false, "cloud.google.com/go/storage@v1.28.1\n"},
	} {
		buf := &bytes.Buffer{}
		logger := log.New(buf, "", 0)
		filesystem := fstest.MapFS{test.fileName: &fstest.MapFile{Data: []byte(test.contents)}}
		err := check(filesystem, logger, test.args)
		if test.valid && err != nil {
			t.Error(test.description, err)
		} else if !test.valid && err == nil {
			t.Error(test.description, "error expected")
		}
		if buf.String() != test.expectedOutput {
			t.Error(test.description, buf.String())
		}
	}
}

func TestModules(t *testing.T) {
	buf := &bytes.Buffer{}
	logger := log.New(buf, "", 0)
	filesystem := fstest.MapFS{"go.mod": &fstest.MapFile{Data: []byte(`
	require (
		cloud.google.com/go/storage v1.28.1
		cuelang.org/go v0.5.0 // @as-code @grafana/grafana-backend-group
		github.com/Azure/azure-sdk-for-go v65.0.0+incompatible // indirect, @delivery
		github.com/Masterminds/semver v1.5.0 // @delivery @grafana/grafana-backend-group
	)
	`)}}

	err := modules(filesystem, logger, []string{"go.mod"})
	if err != nil {
		t.Error(err, buf.String())
	}

	logs := buf.String()

	// Expected results
	expectedModules := []string{
		"cloud.google.com/go/storage@v1.28.1",
		"cuelang.org/go@v0.5.0",
		"github.com/Masterminds/semver@v1.5.0",
		"",
	}

	expectedResults := strings.Join(expectedModules, "\n")

	// Compare logs to expected results
	if logs != expectedResults {
		t.Error(logs)
		t.Error(expectedResults)
	}
}

func TestTeamSlug(t *testing.T) {
	for _, test := range []struct {
		owner string
		slug  string
		ok    bool
	}{
		{"@grafana/grafana-backend-services-squad", "grafana-backend-services-squad", true},
		{"@grafana/alerting-backend", "alerting-backend", true},
		{"@grafana-app-platform-squad", "", false},
		{"@delivery", "", false},
		{"grafana/grafana-backend-group", "grafana-backend-group", true},
		{"", "", false},
	} {
		slug, ok := teamSlug(test.owner)
		if slug != test.slug || ok != test.ok {
			t.Errorf("%q: got (%q, %v), want (%q, %v)", test.owner, slug, ok, test.slug, test.ok)
		}
	}
}

func TestReviewers(t *testing.T) {
	oldMod := `
module example.com/grafana

require (
	cloud.google.com/go/storage v1.28.1 // @grafana/grafana-backend-group
	cuelang.org/go v0.5.0 // @grafana/grafana-as-code
	github.com/Azure/azure-sdk-for-go v65.0.0+incompatible // indirect, @grafana/data-sources-plugins
	github.com/Masterminds/semver v1.5.0 // @grafana/grafana-backend-services-squad
)
`
	for _, test := range []struct {
		description string
		oldContents string
		newContents string
		want        string
	}{
		{
			description: "version bump requests current owner",
			oldContents: oldMod,
			newContents: `
module example.com/grafana

require (
	cloud.google.com/go/storage v1.30.1 // @grafana/grafana-backend-group
	cuelang.org/go v0.5.0 // @grafana/grafana-as-code
	github.com/Azure/azure-sdk-for-go v65.0.0+incompatible // indirect, @grafana/data-sources-plugins
	github.com/Masterminds/semver v1.5.0 // @grafana/grafana-backend-services-squad
)
`,
			want: "grafana-backend-group\n",
		},
		{
			description: "added module requests new owner",
			oldContents: oldMod,
			newContents: `
module example.com/grafana

require (
	cloud.google.com/go/storage v1.28.1 // @grafana/grafana-backend-group
	cuelang.org/go v0.5.0 // @grafana/grafana-as-code
	github.com/Azure/azure-sdk-for-go v65.0.0+incompatible // indirect, @grafana/data-sources-plugins
	github.com/Masterminds/semver v1.5.0 // @grafana/grafana-backend-services-squad
	github.com/open-feature/go-sdk v1.17.2 // @grafana/grafana-backend-services-squad
)
`,
			want: "grafana-backend-services-squad\n",
		},
		{
			description: "removed module requests old owner",
			oldContents: oldMod,
			newContents: `
module example.com/grafana

require (
	cloud.google.com/go/storage v1.28.1 // @grafana/grafana-backend-group
	github.com/Azure/azure-sdk-for-go v65.0.0+incompatible // indirect, @grafana/data-sources-plugins
	github.com/Masterminds/semver v1.5.0 // @grafana/grafana-backend-services-squad
)
`,
			want: "grafana-as-code\n",
		},
		{
			description: "owner comment change requests both teams",
			oldContents: oldMod,
			newContents: `
module example.com/grafana

require (
	cloud.google.com/go/storage v1.28.1 // @grafana/grafana-backend-services-squad
	cuelang.org/go v0.5.0 // @grafana/grafana-as-code
	github.com/Azure/azure-sdk-for-go v65.0.0+incompatible // indirect, @grafana/data-sources-plugins
	github.com/Masterminds/semver v1.5.0 // @grafana/grafana-backend-services-squad
)
`,
			want: "grafana-backend-group\ngrafana-backend-services-squad\n",
		},
		{
			description: "unchanged go.mod requests nobody",
			oldContents: oldMod,
			newContents: oldMod,
			want:        "",
		},
		{
			description: "indirect version bump is ignored",
			oldContents: oldMod,
			newContents: `
module example.com/grafana

require (
	cloud.google.com/go/storage v1.28.1 // @grafana/grafana-backend-group
	cuelang.org/go v0.5.0 // @grafana/grafana-as-code
	github.com/Azure/azure-sdk-for-go v66.0.0+incompatible // indirect, @grafana/data-sources-plugins
	github.com/Masterminds/semver v1.5.0 // @grafana/grafana-backend-services-squad
)
`,
			want: "",
		},
		{
			description: "malformed owner is skipped",
			oldContents: `
module example.com/grafana

require (
	cloud.google.com/go/storage v1.28.1 // @grafana-backend-group
	cuelang.org/go v0.5.0 // @grafana/grafana-as-code
)
`,
			newContents: `
module example.com/grafana

require (
	cloud.google.com/go/storage v1.30.1 // @grafana-backend-group
	cuelang.org/go v0.5.0 // @grafana/grafana-as-code
)
`,
			want: "",
		},
		{
			description: "two bumps request both owners once",
			oldContents: oldMod,
			newContents: `
module example.com/grafana

require (
	cloud.google.com/go/storage v1.30.1 // @grafana/grafana-backend-group
	cuelang.org/go v0.6.0 // @grafana/grafana-as-code
	github.com/Azure/azure-sdk-for-go v65.0.0+incompatible // indirect, @grafana/data-sources-plugins
	github.com/Masterminds/semver v1.5.0 // @grafana/grafana-backend-services-squad
)
`,
			want: "grafana-as-code\ngrafana-backend-group\n",
		},
	} {
		t.Run(test.description, func(t *testing.T) {
			buf := &bytes.Buffer{}
			logger := log.New(buf, "", 0)
			filesystem := fstest.MapFS{
				"old.mod": &fstest.MapFile{Data: []byte(test.oldContents)},
				"new.mod": &fstest.MapFile{Data: []byte(test.newContents)},
			}
			if err := reviewers(filesystem, logger, []string{"old.mod", "new.mod"}); err != nil {
				t.Fatal(err)
			}
			if buf.String() != test.want {
				t.Errorf("got %q, want %q", buf.String(), test.want)
			}
		})
	}
}
