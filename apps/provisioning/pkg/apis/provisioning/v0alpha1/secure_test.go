package v0alpha1_test

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// The struct shapes Secure had before it became a map, with their original JSON tags.
type legacyRepositorySecure struct {
	Token            resource.InlineSecureValue `json:"token,omitzero,omitempty"`
	WebhookSecret    resource.InlineSecureValue `json:"webhookSecret,omitzero,omitempty"`
	CommitSigningKey resource.InlineSecureValue `json:"commitSigningKey,omitzero,omitempty"`
}

func (v legacyRepositorySecure) IsZero() bool {
	return v.Token.IsZero() && v.WebhookSecret.IsZero() && v.CommitSigningKey.IsZero()
}

type legacyConnectionSecure struct {
	PrivateKey   resource.InlineSecureValue `json:"privateKey,omitzero,omitempty"`
	ClientSecret resource.InlineSecureValue `json:"clientSecret,omitzero,omitempty"`
	Token        resource.InlineSecureValue `json:"token,omitzero,omitempty"`
}

func (v legacyConnectionSecure) IsZero() bool {
	return v.PrivateKey.IsZero() && v.ClientSecret.IsZero() && v.Token.IsZero()
}

type legacyObject[T any] struct {
	Secure T `json:"secure,omitzero,omitempty"`
}

func TestSecureValues_JSONMatchesLegacyStruct(t *testing.T) {
	description := "a description"
	repositoryInputs := map[string]string{
		"no secure":     `{}`,
		"empty secure":  `{"secure":{}}`,
		"only names":    `{"secure":{"token":{"name":"t"},"webhookSecret":{"name":"w"},"commitSigningKey":{"name":"c"}}}`,
		"create/remove": `{"secure":{"token":{"create":"secret","description":"` + description + `"},"webhookSecret":{"remove":true}}}`,
		"zero entries":  `{"secure":{"token":{},"webhookSecret":{"description":"only a description"}}}`,
		"unknown keys":  `{"secure":{"token":{"name":"t"},"privateKey":{"create":"secret"},"other":{"name":"x"}}}`,
		"only unknown":  `{"secure":{"other":{"name":"x"}}}`,
	}
	connectionInputs := map[string]string{
		"no secure":     `{}`,
		"only names":    `{"secure":{"privateKey":{"name":"p"},"clientSecret":{"name":"c"},"token":{"name":"t"}}}`,
		"create/remove": `{"secure":{"privateKey":{"create":"secret"},"clientSecret":{"remove":true}}}`,
		"zero entries":  `{"secure":{"privateKey":{},"token":{"description":"only a description"}}}`,
		"unknown keys":  `{"secure":{"token":{"name":"t"},"webhookSecret":{"create":"secret"}}}`,
	}

	for name, input := range repositoryInputs {
		t.Run("Repository/"+name, func(t *testing.T) {
			var legacy legacyObject[legacyRepositorySecure]
			require.NoError(t, json.Unmarshal([]byte(input), &legacy))
			legacyJSON, err := json.Marshal(legacy)
			require.NoError(t, err)

			var repo v0alpha1.Repository
			require.NoError(t, json.Unmarshal([]byte(input), &repo))
			repo.NormalizeSecureValues()
			assertSecureJSONEqual(t, legacyJSON, repo)

			// Stored objects decode into the map and encode back unchanged.
			var stored v0alpha1.Repository
			require.NoError(t, json.Unmarshal(legacyJSON, &stored))
			assertSecureJSONEqual(t, legacyJSON, stored)
		})
	}
	for name, input := range connectionInputs {
		t.Run("Connection/"+name, func(t *testing.T) {
			var legacy legacyObject[legacyConnectionSecure]
			require.NoError(t, json.Unmarshal([]byte(input), &legacy))
			legacyJSON, err := json.Marshal(legacy)
			require.NoError(t, err)

			var conn v0alpha1.Connection
			require.NoError(t, json.Unmarshal([]byte(input), &conn))
			conn.NormalizeSecureValues()
			assertSecureJSONEqual(t, legacyJSON, conn)

			var stored v0alpha1.Connection
			require.NoError(t, json.Unmarshal(legacyJSON, &stored))
			assertSecureJSONEqual(t, legacyJSON, stored)
		})
	}
}

// assertSecureJSONEqual compares the secure property of obj with the legacy encoding.
// Key order is not compared: maps encode their keys sorted, structs in field order.
func assertSecureJSONEqual(t *testing.T, legacyJSON []byte, obj any) {
	t.Helper()
	objJSON, err := json.Marshal(obj)
	require.NoError(t, err)

	var got map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(objJSON, &got))
	secure, ok := got["secure"]
	if !ok {
		assert.JSONEq(t, string(legacyJSON), `{}`)
		return
	}
	assert.JSONEq(t, string(legacyJSON), `{"secure":`+string(secure)+`}`)
}

func TestSecureValues_SetSecureValue(t *testing.T) {
	var repo v0alpha1.Repository
	repo.SetSecureValue(v0alpha1.RepositorySecureToken, resource.InlineSecureValue{})
	assert.Nil(t, repo.Secure, "a zero value must not allocate the map")

	repo.SetSecureValue(v0alpha1.RepositorySecureToken, resource.InlineSecureValue{Name: "t"})
	assert.Equal(t, resource.InlineSecureValues{v0alpha1.RepositorySecureToken: {Name: "t"}}, repo.Secure)

	repo.SetSecureValue(v0alpha1.RepositorySecureToken, resource.InlineSecureValue{})
	assert.Empty(t, repo.Secure, "a zero value removes the key")

	var conn v0alpha1.Connection
	conn.SetSecureValue(v0alpha1.ConnectionSecureToken, resource.InlineSecureValue{Remove: true})
	assert.Equal(t, resource.InlineSecureValues{v0alpha1.ConnectionSecureToken: {Remove: true}}, conn.Secure)
}

func TestSecureValues_KeysMatchSchema(t *testing.T) {
	assert.ElementsMatch(t, jsonNames(t, v0alpha1.SecureValues{}), v0alpha1.RepositorySecureKeys)
	assert.ElementsMatch(t, jsonNames(t, v0alpha1.ConnectionSecure{}), v0alpha1.ConnectionSecureKeys)
}

func jsonNames(t *testing.T, v any) []string {
	t.Helper()
	typ := reflect.TypeOf(v)
	names := make([]string, 0, typ.NumField())
	for i := range typ.NumField() {
		name, _, _ := strings.Cut(typ.Field(i).Tag.Get("json"), ",")
		require.NotEmpty(t, name, "field %s has no JSON name", typ.Field(i).Name)
		names = append(names, name)
	}
	return names
}

func TestGetOpenAPIDefinitionsWithSecureValues(t *testing.T) {
	ref := func(path string) spec.Ref { return spec.MustCreateRef(path) }
	defs := v0alpha1.GetOpenAPIDefinitionsWithSecureValues(ref)

	for kind, secure := range map[string]string{
		v0alpha1.Repository{}.OpenAPIModelName(): v0alpha1.SecureValues{}.OpenAPIModelName(),
		v0alpha1.Connection{}.OpenAPIModelName(): v0alpha1.ConnectionSecure{}.OpenAPIModelName(),
	} {
		def := defs[kind]
		assert.Equal(t, spec.Schema{SchemaProps: spec.SchemaProps{
			Default: map[string]interface{}{},
			Ref:     ref(secure),
		}}, def.Schema.Properties["secure"], kind)
		assert.Contains(t, def.Dependencies, secure, kind)
		assert.NotContains(t, def.Dependencies, resource.InlineSecureValue{}.OpenAPIModelName(), kind)
		assert.Empty(t, defs[secure].Schema.Description, "%s must keep an empty description", secure)
	}
}
