package setting

import (
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestReadGraphiteSettings(t *testing.T) {
	tests := []struct {
		name           string
		render         *string
		resourceResp   *string
		resourceReq    *string
		expectedRender int64
		expectedResp   int64
		expectedReq    int64
	}{
		{
			name:           "absent keys leave fields at zero so the consuming service uses its defaults",
			expectedRender: 0,
			expectedResp:   0,
			expectedReq:    0,
		},
		{
			name:           "explicit zero is preserved (means use default)",
			render:         new("0"),
			resourceResp:   new("0"),
			resourceReq:    new("0"),
			expectedRender: 0,
			expectedResp:   0,
			expectedReq:    0,
		},
		{
			name:           "negative values are coerced to zero (use default)",
			render:         new("-1"),
			expectedRender: 0,
		},
		{
			name:           "values inside [1 KiB, 1 GiB] pass through unchanged",
			render:         new(strconv.FormatInt(200<<20, 10)),
			resourceResp:   new(strconv.FormatInt(32<<20, 10)),
			resourceReq:    new(strconv.FormatInt(1<<20, 10)),
			expectedRender: 200 << 20,
			expectedResp:   32 << 20,
			expectedReq:    1 << 20,
		},
		{
			name:           "values at the bounds pass through unchanged",
			render:         new(strconv.FormatInt(graphiteCapMinBytes, 10)),
			resourceResp:   new(strconv.FormatInt(graphiteCapMaxBytes, 10)),
			expectedRender: graphiteCapMinBytes,
			expectedResp:   graphiteCapMaxBytes,
		},
		{
			name:           "sub-minimum values clamp to floor",
			render:         new("100"),
			expectedRender: graphiteCapMinBytes,
		},
		{
			name:           "super-maximum values clamp to ceiling",
			render:         new(strconv.FormatInt(10*graphiteCapMaxBytes, 10)),
			expectedRender: graphiteCapMaxBytes,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := ini.Empty()
			section, err := f.NewSection("tsdb.graphite")
			require.NoError(t, err)
			if tt.render != nil {
				_, err = section.NewKey("render_response_max_bytes", *tt.render)
				require.NoError(t, err)
			}
			if tt.resourceResp != nil {
				_, err = section.NewKey("resource_response_max_bytes", *tt.resourceResp)
				require.NoError(t, err)
			}
			if tt.resourceReq != nil {
				_, err = section.NewKey("resource_request_max_bytes", *tt.resourceReq)
				require.NoError(t, err)
			}

			cfg := NewCfg()
			require.NoError(t, readGraphiteSettings(f, cfg))

			assert.Equal(t, tt.expectedRender, cfg.GraphiteRenderResponseMaxBytes)
			assert.Equal(t, tt.expectedResp, cfg.GraphiteResourceResponseMaxBytes)
			assert.Equal(t, tt.expectedReq, cfg.GraphiteResourceRequestMaxBytes)
		})
	}
}
