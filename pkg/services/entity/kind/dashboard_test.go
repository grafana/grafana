package kind

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCreateDashboard(t *testing.T) {
	d := DashboardEntity{}

	d.UID = "aaa"
	d.SchemaVersion = "v"

	d.Body = map[string]interface{}{
		"aaa": "bbbbbb",
	}

	fmt.Printf("%+v", d)

	require.FailNow(t, "see console.log")
}
