package dbimpl

import (
	"cmp"
	"errors"
	"fmt"
	"net"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/grafana/grafana/pkg/setting"
)

var errInvalidUTF8Sequence = errors.New("invalid UTF-8 sequence")

type sectionGetter struct {
	*setting.DynamicSection
	err error
}

func (g *sectionGetter) Err() error {
	return g.err
}

func (g *sectionGetter) String(key string) string {
	v := g.DynamicSection.Key(key).MustString("")
	if !utf8.ValidString(v) {
		g.err = fmt.Errorf("value for key %q: %w", key, errInvalidUTF8Sequence)

		return ""
	}

	return v
}

// MakeDSN creates a DSN from the given key/value pair. It validates the strings
// form valid UTF-8 sequences and escapes values if needed.
func MakeDSN(m map[string]string) (string, error) {
	b := new(strings.Builder)

	ks := keys(m)
	sort.Strings(ks) // provide deterministic behaviour
	for _, k := range ks {
		v := m[k]
		if !utf8.ValidString(v) {
			return "", fmt.Errorf("value for DSN key %q: %w", k,
				errInvalidUTF8Sequence)
		}
		if v == "" {
			continue
		}

		if b.Len() > 0 {
			_ = b.WriteByte(' ')
		}
		_, _ = b.WriteString(k)
		_ = b.WriteByte('=')
		writeDSNValue(b, v)
	}

	return b.String(), nil
}

func keys(m map[string]string) []string {
	ret := make([]string, 0, len(m))
	for k := range m {
		ret = append(ret, k)
	}
	return ret
}

func writeDSNValue(b *strings.Builder, v string) {
	numq := strings.Count(v, `'`)
	numb := strings.Count(v, `\`)
	if numq+numb == 0 && v != "" {
		b.WriteString(v)

		return
	}
	b.Grow(2 + numq + numb + len(v))

	_ = b.WriteByte('\'')
	for _, r := range v {
		if r == '\\' || r == '\'' {
			_ = b.WriteByte('\\')
		}
		_, _ = b.WriteRune(r)
	}
	_ = b.WriteByte('\'')
}

// splitHostPortDefault is similar to net.SplitHostPort, but will also accept a
// specification with no port and apply the default port instead. It also
// applies the given defaults if the results are empty strings.
func splitHostPortDefault(hostport, defaultHost, defaultPort string) (string, string, error) {
	host, port, err := net.SplitHostPort(hostport)
	if err != nil {
		// try appending the port
		host, port, err = net.SplitHostPort(hostport + ":" + defaultPort)
		if err != nil {
			return "", "", fmt.Errorf("invalid hostport: %q", hostport)
		}
	}
	host = cmp.Or(host, defaultHost)
	port = cmp.Or(port, defaultPort)

	return host, port, nil
}
