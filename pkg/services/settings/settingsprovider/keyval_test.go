package settingsprovider

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestImplementation_MustStringReturnsDefaultValueProperly(t *testing.T) {
	t.Run("When Key is not null but value is empty, MustString returns default value", func(t *testing.T) {
		var emptyKV = keyValue{
			key:   "somekey",
			value: "",
		}

		require.EqualValues(t, "TEST", emptyKV.MustString("TEST"))
	})

	t.Run("When Key is not null and value is value, MustString returns value", func(t *testing.T) {
		var emptyKV = keyValue{
			key:   "somekey",
			value: "val",
		}

		require.EqualValues(t, "val", emptyKV.MustString("TEST"))
	})

	t.Run("when some key is empty but value is a value, MustString returns the value", func(t *testing.T) {
		var emptyKV = keyValue{
			key:   "",
			value: "val",
		}

		require.EqualValues(t, "val", emptyKV.MustString("TEST"))
	})
}
