package resources

import (
	"crypto/sha256"
	"encoding/hex"
	"path"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParseFolderID(t *testing.T) {
	hash := func(s string) string {
		hashed := sha256.Sum256([]byte(strings.Trim(path.Clean(s), "/"))) // just to make it easier to do strings.Repeat with slashes
		return hex.EncodeToString(hashed[:])[:8]
	}

	cases := []struct {
		Description string
		Path        string
		Title       string
		KubeName    string
	}{
		{"Short, simple path", "hello/world", "world", "world-" + hash("hello/world")},
		{"Capital letters and punctuation", "Hello, World!", "Hello, World!", "hello-world-" + hash("Hello, World!")},
		// With fish: echo (string repeat -n 200 -m (math 253-9) "helloworld")-(string repeat -n 200 "/hello/world" | sha256sum | awk '{print substr($1,0,8);}')
		{"Very long name", strings.Repeat("/hello/world", 200), "world", "world-" + hash(strings.Repeat("hello/world/", 200))},
		{"Leading, trailing, and unnecessary slashes", "/hello///world////", "world", "world-" + hash("hello/world")},
	}

	for _, c := range cases {
		t.Run(c.Description, func(t *testing.T) {
			id := ParseFolderID(c.Path)
			assert.Equal(t, c.Path, id.Path)
			assert.Equal(t, c.KubeName, id.KubernetesName)
			assert.Equal(t, c.Title, id.Title)
		})
	}
}
