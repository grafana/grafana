package gogit

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestProgressParsing(t *testing.T) {
	tests := []struct {
		name   string
		input  string
		expect []string
	}{
		{
			name:   "no breaks",
			input:  "some text",
			expect: []string{"some text"},
		},
		{
			name:   "with cr",
			input:  "hello\rworld",
			expect: []string{"hello", "world"},
		},
		{
			name:   "with nl",
			input:  "hello\nworld",
			expect: []string{"hello", "world"},
		},
		{
			name:   "with cr+nl",
			input:  "hello\r\nworld",
			expect: []string{"hello", "world"},
		},
	}
	for _, tt := range tests {
		lastLine := "***LAST*LINE***"
		t.Run(tt.name, func(t *testing.T) {
			lines := []string{}
			writer := Progress(func(line string) {
				lines = append(lines, line)
			}, lastLine)
			_, _ = writer.Write([]byte(tt.input))
			err := writer.Close()
			require.NoError(t, err)

			assert.EventuallyWithT(t, func(c *assert.CollectT) {
				assert.NotEmpty(c, lines)
				assert.Equal(c, lastLine, lines[len(lines)-1])

				// Compare the results
				require.Equal(c, tt.expect, lines[0:len(lines)-1])
			}, time.Millisecond*100, time.Microsecond*50)
		})
	}
}
