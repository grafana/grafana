// +build 1.6

package api_test

import (
	"testing"

	"github.com/aws/aws-sdk-go/private/model/api"
	"github.com/stretchr/testify/assert"
)

func TestShapeTagJoin(t *testing.T) {
	s := api.ShapeTags{
		{Key: "location", Val: "query"},
		{Key: "locationName", Val: "abc"},
		{Key: "type", Val: "string"},
	}

	expected := `location:"query" locationName:"abc" type:"string"`

	o := s.Join(" ")
	o2 := s.String()
	assert.Equal(t, expected, o)
	assert.Equal(t, expected, o2)
}
