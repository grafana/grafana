package search

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

// openapi-gen gives a required field its zero value as the default, so the
// operator of a filter would default to "", which its enum does not allow and
// the API rejects. The published spec must not offer it.
func TestEnvelopeDefinitions_DropsDefaultOutsideEnum(t *testing.T) {
	defs := envelopeDefinitions(builder.RouteSchemaRef)

	predicate, ok := defs[envelopePkg+"FilterPredicate"]
	require.True(t, ok, "the filter predicate is part of the envelope")

	operator := predicate.Schema.Properties["operator"]
	require.Nil(t, operator.Default, "a default outside the enum is dropped")
	require.Equal(t, []any{"All", "In", "NotIn"}, operator.Enum)
	require.Contains(t, predicate.Schema.Required, "operator", "the operator stays required")

	field := predicate.Schema.Properties["field"]
	require.Equal(t, "", field.Default, "a property without an enum keeps its default")
}
