package v1

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1/store"
)

func TestValidateTemplateUID(t *testing.T) {
	testCases := []struct {
		name    string
		uid     string
		wantErr bool
	}{
		{name: "valid", uid: "my-template.1"},
		{name: "max length", uid: strings.Repeat("a", 40)},
		{name: "empty", uid: "", wantErr: true},
		{name: "blank", uid: "  ", wantErr: true},
		{name: "colon", uid: "a:b", wantErr: true},
		{name: "too long", uid: strings.Repeat("a", 41), wantErr: true},
		{name: "uppercase", uid: "Upper", wantErr: true},
		{name: "underscore", uid: "a_b", wantErr: true},
		{name: "base64 of a template name", uid: "Z3JhZmFuYXx0ZXN0", wantErr: true},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateTemplateUID(tc.uid)
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestTemplateUID(t *testing.T) {
	names := []string{"template", "Template With Spaces", "ünïcödé 工作时间 🕒", strings.Repeat("a very long template name ", 50)}

	seen := map[ResourceUID]string{}
	for _, kind := range []TemplateKind{TemplateKindGrafana, TemplateKindMimir} {
		for _, name := range names {
			uid := TemplateUID(kind, name)
			assert.Equal(t, uid, TemplateUID(kind, name), "must be deterministic")
			assert.NoError(t, ValidateTemplateUID(string(uid)), name)
			assert.Len(t, uid, 25)
			assert.NotEqual(t, ResourceUID(models.NameToUid(string(kind)+"|"+name)), uid, "must not be the UID that used to be derived")
			other, dup := seen[uid]
			assert.Falsef(t, dup, "%q and %q share a UID", string(kind)+name, other)
			seen[uid] = string(kind) + name
		}
	}
}

func TestResolveTemplateUID(t *testing.T) {
	t.Run("keeps a stored UID that is valid", func(t *testing.T) {
		assert.Equal(t, ResourceUID("stored-uid"), ResolveTemplateUID("stored-uid", TemplateKindGrafana, "name"))
	})

	t.Run("derives the UID when none is stored", func(t *testing.T) {
		assert.Equal(t, TemplateUID(TemplateKindGrafana, "name"), ResolveTemplateUID("", TemplateKindGrafana, "name"))
	})

	t.Run("derives the UID when the stored one is not valid", func(t *testing.T) {
		for description, stored := range map[string]string{
			"derived from the title, mixed case": models.NameToUid("grafana|name"),
			"derived from a long title":          models.NameToUid("grafana|" + strings.Repeat("name", 20)),
			"colon":                              "a:b",
			"underscore":                         "a_b",
			"too long":                           strings.Repeat("a", 41),
		} {
			assert.Equal(t, TemplateUID(TemplateKindGrafana, "name"), ResolveTemplateUID(stored, TemplateKindGrafana, "name"), description)
		}
	})
}

func TestManagedTemplatesToTemplates(t *testing.T) {
	managed := func(name string) store.PostableApiTemplateDB {
		return store.PostableApiTemplateDB{Name: name, Content: `{{ define "` + name + `" }}x{{ end }}`, Kind: string(TemplateKindGrafana)}
	}
	oldUID := models.NameToUid("grafana|a")

	t.Run("replaces a key that is not a valid UID", func(t *testing.T) {
		got := ManagedTemplatesToTemplates(map[string]store.PostableApiTemplateDB{oldUID: managed("a"), "valid-uid": managed("b")})

		require.Len(t, got, 2)
		expected := TemplateUID(TemplateKindGrafana, "a")
		require.Contains(t, got, expected)
		assert.Equal(t, expected, got[expected].UID)
		assert.Equal(t, "a", got[expected].Title)
		require.Contains(t, got, ResourceUID("valid-uid"))
		assert.Equal(t, ResourceUID("valid-uid"), got["valid-uid"].UID)
	})

	t.Run("writes the replacement as the key", func(t *testing.T) {
		stored := ManagedTemplatesToTemplates(map[string]store.PostableApiTemplateDB{oldUID: managed("a")})

		written := TemplatesToManagedTemplates(stored)

		require.Len(t, written, 1)
		assert.Contains(t, written, string(TemplateUID(TemplateKindGrafana, "a")))
		assert.Equal(t, ManagedTemplatesToTemplates(written), stored, "it is the same when it is read again")
	})

	t.Run("nil stays nil", func(t *testing.T) {
		assert.Nil(t, ManagedTemplatesToTemplates(nil))
	})
}
