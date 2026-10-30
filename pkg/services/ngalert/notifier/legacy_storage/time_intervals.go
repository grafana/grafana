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

// SetTimeInterval stores ti under its own UID. The caller is responsible for that UID already
// being right: a create assigns a fresh one, an update carries the existing one forward so a
// rename doesn't change identity.
func (rev *ConfigRevision) SetTimeInterval(ti v1.TimeInterval) v1.TimeInterval {
	if rev.Config.TimeIntervals == nil {
		rev.Config.TimeIntervals = make(map[v1.ResourceUID]v1.TimeInterval)
	}
	ti.Version = v1.TimeIntervalFingerprint(ti)
	rev.Config.TimeIntervals[ti.UID] = ti
	return ti
}

func (rev *ConfigRevision) DeleteTimeInterval(uid v1.ResourceUID) {
	delete(rev.Config.TimeIntervals, uid)
}
