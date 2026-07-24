package resources

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLogGroupFieldsRequest(t *testing.T) {
	t.Run("Should parse valid parameters", func(t *testing.T) {
		request, err := ParseLogGroupFieldsRequest(map[string][]string{
			"region":       {"us-east-1"},
			"logGroupName": {"my-log-group"},
			"logGroupArn":  {"arn:aws:logs:us-east-1:123456789012:log-group:my-log-group"}},
		)
		require.NoError(t, err)
		assert.Equal(t, "us-east-1", request.Region)
		assert.Equal(t, "my-log-group", request.LogGroupName)
		assert.Equal(t, "arn:aws:logs:us-east-1:123456789012:log-group:my-log-group", request.LogGroupARN)
	})

	t.Run("Should return an error if arn and name is missing ", func(t *testing.T) {
		request, err := ParseLogGroupFieldsRequest(map[string][]string{
			"region": {"us-east-1"},
		},
		)
		require.Empty(t, request)
		require.Error(t, fmt.Errorf("you need to specify either logGroupName or logGroupArn"), err)
	})
}
