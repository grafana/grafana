package historian

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/gogo/protobuf/proto"
	"github.com/golang/snappy"
	"github.com/grafana/grafana/pkg/components/loki/logproto"
	"github.com/prometheus/common/model"
	"golang.org/x/exp/slices"
)

type JsonEncoder struct{}

func (e JsonEncoder) encode(s []stream) ([]byte, error) {
	body := struct {
		Streams []stream `json:"streams"`
	}{Streams: s}
	enc, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("failed to serialize Loki payload: %w", err)
	}
	return enc, nil
}

func (e JsonEncoder) headers() map[string]string {
	return map[string]string{
		"Content-Type": "application/json",
	}
}

type SnappyProtoEncoder struct{}

func (e SnappyProtoEncoder) encode(s []stream) ([]byte, error) {
	body := logproto.PushRequest{
		Streams: make([]logproto.Stream, 0, len(s)),
	}

	for _, str := range s {
		entries := make([]logproto.Entry, 0, len(str.Values))
		for _, sample := range str.Values {
			entries = append(entries, logproto.Entry{
				Timestamp: sample.T,
				Line:      sample.V,
			})
		}
		body.Streams = append(body.Streams, logproto.Stream{
			Labels:  labelsMapToString(str.Stream, ""),
			Entries: entries,
			// Hash seems to be mainly used for query responses. Promtail does not seem to calculate this field on push.
		})
	}

	buf, err := proto.Marshal(&body)
	if err != nil {
		return nil, fmt.Errorf("failed to serialize Loki payload to proto: %w", err)
	}
	buf = snappy.Encode(nil, buf)
	return buf, nil
}

func (e SnappyProtoEncoder) headers() map[string]string {
	return map[string]string{
		"Content-Type":     "application/x-protobuf",
		"Content-Encoding": "snappy",
	}
}

// Copied from promtail.
// Modified slightly to work in terms of plain map[string]string to avoid some unnecessary copies and type casts.
// TODO: pkg/components/loki/lokihttp/batch.go contains an older (loki 2.7.4 released) version of this.
// TODO: Consider replacing that one, with this one.
func labelsMapToString(ls map[string]string, without model.LabelName) string {
	var b strings.Builder
	totalSize := 2
	lstrs := make([]string, 0, len(ls))

	for l, v := range ls {
		if l == string(without) {
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

		b.WriteString(l)
		b.WriteString(`=`)
		b.WriteString(strconv.Quote(ls[l]))
	}
	b.WriteByte('}')

	return b.String()
}
