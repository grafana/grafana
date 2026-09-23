package legacy_storage

import (
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
)

func (rev *ConfigRevision) GetTimeIntervalWithTitle(title string) (v1.TimeInterval, bool) {
	for _, ti := range rev.Config.TimeIntervals {
		if ti.Title == title {
			return ti, true
		}
	}
	return v1.TimeInterval{}, false
}

func (rev *ConfigRevision) SetTimeInterval(ti v1.TimeInterval) v1.TimeInterval {
	if rev.Config.TimeIntervals == nil {
		rev.Config.TimeIntervals = make(map[v1.ResourceUID]v1.TimeInterval)
	}
	// The UID is derived from the title, so always key by the title's UID rather than trusting
	// the caller's value. On rename the caller passes the old UID (to locate the existing entry);
	// recomputing here ensures the renamed interval is stored under its new UID instead of
	// overwriting and then being deleted under the old one.
	ti.UID = v1.TimeIntervalUID(ti.Title)
	// Ensure Version is set.
	ti.Version = v1.TimeIntervalFingerprint(ti)
	rev.Config.TimeIntervals[ti.UID] = ti
	return ti
}

func (rev *ConfigRevision) DeleteTimeInterval(uid v1.ResourceUID) {
	delete(rev.Config.TimeIntervals, uid)
}
