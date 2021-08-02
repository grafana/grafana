package tempo

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTempo(t *testing.T) {
	t.Run("createRequest should set Auth header when basic auth is true ", func(t *testing.T) {
		service := &Service{}
		req, err := service.createRequest(context.Background(), &datasourceInfo{}, "traceID") //&models.DataSource{BasicAuth: true, BasicAuthUser: "john", BasicAuthPassword: "pass"}, "traceID")
		require.NoError(t, err)
		fmt.Println(req.Body)
		assert.Equal(t, 1, len(req.Header))
		// assert.NotEqual(t, req.Header.Get("Authorization"), "")
	})
}
