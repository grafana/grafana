package lokihttp

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/gogo/protobuf/proto"
	"github.com/golang/snappy"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/components/loki/logproto"
)

// batch holds pending log streams waiting to be sent to Loki, and it's used
// to reduce the number of push requests to Loki aggregating multiple log streams
// and entries in a single batch request. In case of multi-tenant Promtail, log
// streams for each tenant are stored in a dedicated batch.
type batch struct {
	streams   map[string]*logproto.Stream
	bytes     int
	createdAt time.Time
}

func newBatch(entries ...Entry) *batch {
	b := &batch{
		streams:   map[string]*logproto.Stream{},
		bytes:     0,
		createdAt: time.Now(),
	}

	// Add entries to the batch
	for _, entry := range entries {
		b.add(entry)
	}

	return b
}

// add an entry to the batch
func (b *batch) add(entry Entry) {
	b.bytes += len(entry.Line)

	// Append the entry to an already existing stream (if any)
	labels := labelsMapToString(entry.Labels, ReservedLabelTenantID)
	if stream, ok := b.streams[labels]; ok {
		stream.Entries = append(stream.Entries, entry.Entry)
		return
	}

	// Add the entry as a new stream
	b.streams[labels] = &logproto.Stream{
		Labels:  labels,
		Entries: []logproto.Entry{entry.Entry},
	}
}

func labelsMapToString(ls model.LabelSet, without ...model.LabelName) string {
	lstrs := make([]string, 0, len(ls))
Outer:
	for l, v := range ls {
		for _, w := range without {
			if l == w {
				continue Outer
			}
		}
		lstrs = append(lstrs, fmt.Sprintf("%s=%q", l, v))
	}

	sort.Strings(lstrs)
	return fmt.Sprintf("{%s}", strings.Join(lstrs, ", "))
}

// sizeBytesAfter returns the size of the batch after the input entry
// will be added to the batch itself
func (b *batch) sizeBytesAfter(entry Entry) int {
	return b.bytes + len(entry.Line)
}

// age of the batch since its creation
func (b *batch) age() time.Duration {
	return time.Since(b.createdAt)
}

// encode the batch as snappy-compressed push request, and returns
// the encoded bytes and the number of encoded entries
func (b *batch) encode() ([]byte, int, error) {
	req, entriesCount := b.createPushRequest()
	buf, err := proto.Marshal(req)
	if err != nil {
		return nil, 0, err
	}
	buf = snappy.Encode(nil, buf)
	return buf, entriesCount, nil
}

// creates push request and returns it, together with number of entries
func (b *batch) createPushRequest() (*logproto.PushRequest, int) {
	req := logproto.PushRequest{
		Streams: make([]logproto.Stream, 0, len(b.streams)),
	}

	entriesCount := 0
	for _, stream := range b.streams {
		req.Streams = append(req.Streams, *stream)
		entriesCount += len(stream.Entries)
	}
	return &req, entriesCount
}
