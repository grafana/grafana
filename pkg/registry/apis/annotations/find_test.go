package annotations

import (
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/annotations/pkg/apis/annotations/v0alpha1"
)

func TestParseQuery(t *testing.T) {
	now = func() time.Time { return time.Date(2024, 11, 1, 0, 0, 0, 0, time.UTC) }
	defer func() { now = time.Now }()

	tests := []struct {
		name   string
		input  url.Values
		expect v0alpha1.AnnotationQuery
		err    string
	}{
		{
			name: "simple",
			input: url.Values{
				"from": []string{"now-1h"},
				"to":   []string{"now"},
				"tags": []string{"tag1", "tag2"},
			},
			expect: v0alpha1.AnnotationQuery{
				From: 1730415600000,
				To:   1730419200000,
				Tags: []string{"tag1", "tag2"},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			query, err := parseQuery(tt.input)
			if tt.err != "" {
				require.Error(t, err)
				require.ErrorContains(t, err, tt.err)
				require.Nil(t, query)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.expect, query)
		})
	}
}
