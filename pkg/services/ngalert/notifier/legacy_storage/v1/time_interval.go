package v1

import (
	"encoding/binary"
	"errors"
	"fmt"
	"hash/fnv"
	"slices"
	"strings"
	"unsafe"

	"github.com/prometheus/alertmanager/timeinterval"
	"go.yaml.in/yaml/v3"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type TimeInterval struct {
	ResourceMetadata

	Title         string
	TimeIntervals []timeinterval.TimeInterval // TODO: Replace with local types.
}

func (mt *TimeInterval) ResourceType() string {
	return "muteTimeInterval" // Intentionally kept as-is for backwards compatibility.
}

func (mt *TimeInterval) ResourceID() string {
	return mt.Title
}

func (mt *TimeInterval) Validate() error {
	if mt.Title == "" {
		return errors.New("missing name in time interval")
	}

	// For now, we rely on the upstream validation in marshallers, but we should eventually create local types and move
	// the logic to explicit Validate() methods.
	s, err := yaml.Marshal(mt.TimeIntervals)
	if err != nil {
		return err
	}
	if err = yaml.Unmarshal(s, &(mt.TimeIntervals)); err != nil {
		return err
	}
	return nil
}

// SortedTimeIntervals returns time intervals ordered by title.
func (c *AMConfigV1) SortedTimeIntervals() []TimeInterval {
	res := make([]TimeInterval, 0, len(c.TimeIntervals))
	for _, t := range c.TimeIntervals {
		res = append(res, t)
	}

	return slices.SortedFunc(slices.Values(res), func(a TimeInterval, b TimeInterval) int {
		return strings.Compare(a.Title, b.Title)
	})
}

func NewTimeInterval(name string, intervals []timeinterval.TimeInterval, provenance models.Provenance) TimeInterval {
	ti := TimeInterval{
		ResourceMetadata: ResourceMetadata{
			UID:        TimeIntervalUID(name),
			Provenance: provenance,
		},
		Title:         name,
		TimeIntervals: slices.Clone(intervals),
	}
	ti.Version = TimeIntervalFingerprint(ti)
	return ti
}

func TimeIntervalUID(name string) ResourceUID {
	return ResourceUID(models.NameToUid(name))
}

func TimeIntervalFingerprint(interval TimeInterval) string {
	sum := fnv.New64()

	writeBytes := func(b []byte) {
		_, _ = sum.Write(b)
		// add a byte sequence that cannot happen in UTF-8 strings.
		_, _ = sum.Write([]byte{255})
	}
	writeString := func(s string) {
		if len(s) == 0 {
			writeBytes(nil)
			return
		}
		// avoid allocation when converting string to byte slice
		writeBytes(unsafe.Slice(unsafe.StringData(s), len(s))) // #nosec G103 nosemgrep: go.lang.security.audit.unsafe.use-of-unsafe-block
	}
	// this temp slice is used to convert ints to bytes.
	tmp := make([]byte, 8)
	writeInt := func(u int) {
		binary.LittleEndian.PutUint64(tmp, uint64(u))
		writeBytes(tmp)
	}

	writeRange := func(r timeinterval.InclusiveRange) {
		writeInt(r.Begin)
		writeInt(r.End)
	}

	// fields that determine the rule state
	writeString(interval.Title)
	for _, ti := range interval.TimeIntervals {
		for _, time := range ti.Times {
			writeInt(time.StartMinute)
			writeInt(time.EndMinute)
		}
		for _, itm := range ti.Months {
			writeRange(itm.InclusiveRange)
		}
		for _, itm := range ti.DaysOfMonth {
			writeRange(itm.InclusiveRange)
		}
		for _, itm := range ti.Weekdays {
			writeRange(itm.InclusiveRange)
		}
		for _, itm := range ti.Years {
			writeRange(itm.InclusiveRange)
		}
		if ti.Location != nil {
			writeString(ti.Location.String())
		}
	}
	return fmt.Sprintf("%016x", sum.Sum64())
}
