package historian

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/prometheus/common/model"
	"golang.org/x/exp/slices"
)

type jsonEncoder struct{}

func (e jsonEncoder) encode(s []stream) ([]byte, error) {
	body := struct {
		Streams []stream `json:"streams"`
	}{Streams: s}
	enc, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("failed to serialize Loki payload: %w", err)
	}
	return enc, nil
}

func (e jsonEncoder) headers() map[string]string {
	return map[string]string{
		"Content-Type": "application/json",
	}
}

type snappyProtoEncoder struct{}

func (e snappyProtoEncoder) headers() map[string]string {
	return map[string]string{
		"Content-Type":     "application/x-protobuf",
		"Content-Encoding": "snappy",
	}
}

// TODO: Copied from promtail, main
// TODO: pkg/components/loki/lokihttp/batch.go contains an older (loki 2.7.4) version of this
// TODO: Consider replacing that one, with this one
// TODO: It appears we need this one as it properly quotes label values, thus avoiding problems with "="
// TODO: Test this before submission!
func labelsMapToString(ls model.LabelSet, without model.LabelName) string {
	var b strings.Builder
	totalSize := 2
	lstrs := make([]model.LabelName, 0, len(ls))

	for l, v := range ls {
		if l == without {
			continue
		}

		lstrs = append(lstrs, l)
		// guess size increase: 2 for `, ` between labels and 3 for the `=` and quotes around label value
		totalSize += len(l) + 2 + len(v) + 3
	}

	b.Grow(totalSize)
	b.WriteByte('{')
	slices.Sort(lstrs)
	for i, l := range lstrs {
		if i > 0 {
			b.WriteString(", ")
		}

		b.WriteString(string(l))
		b.WriteString(`=`)
		b.WriteString(strconv.Quote(string(ls[l])))
	}
	b.WriteByte('}')

	return b.String()
}
