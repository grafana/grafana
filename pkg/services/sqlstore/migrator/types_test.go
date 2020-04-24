package migrator

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIndex_DerivedName(t *testing.T) {
	idx := Index{
		Type: IndexType,
		Cols: []string{"id", "name", "version"},
	}
	assert.Equal(t, "id_name_version", idx.derivedName())

	functionalIdx := Index{
		Type: FunctionalIndex,
		Cols: []string{"id", "lower(name)"},
	}
	assert.Equal(t, "id_lower_name", functionalIdx.derivedName())
}
