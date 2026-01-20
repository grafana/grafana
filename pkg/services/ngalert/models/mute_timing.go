package models

import (
	"encoding/binary"
	"fmt"
	"hash/fnv"
	"unsafe"

	"github.com/prometheus/alertmanager/timeinterval"

	"github.com/prometheus/alertmanager/config"
)

type MuteTiming struct {
	UID string
	config.MuteTimeInterval
	Version    string
	Provenance Provenance
	Origin     ResourceOrigin
}

func (mt *MuteTiming) GetUID() string {
	return mt.UID
}

func (mt *MuteTiming) ResourceID() string {
	return mt.UID
}

func (mt *MuteTiming) ResourceType() string {
	return "muteTimeInterval"
}

func (mt *MuteTiming) Fingerprint() string {
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
		// #nosec G103
		// avoid allocation when converting string to byte slice
		writeBytes(unsafe.Slice(unsafe.StringData(s), len(s)))
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
	writeString(mt.Name)
	for _, ti := range mt.TimeIntervals {
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

// MuteTimingMetadata contains metadata about a MuteTiming's usage in routes
type MuteTimingMetadata struct {
	InUseByRules  []AlertRuleKey
	InUseByRoutes int
	// CanUse is true if the mute time interval can be used in routes and rules.
	CanUse bool
}
