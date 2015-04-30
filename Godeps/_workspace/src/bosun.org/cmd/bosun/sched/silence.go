package sched

import (
	"crypto/sha1"
	"encoding/json"
	"fmt"
	"time"

	"bosun.org/cmd/bosun/expr"
	"bosun.org/opentsdb"
)

type Silence struct {
	Start, End time.Time
	Alert      string
	Tags       opentsdb.TagSet
	Forget     bool
}

func (s *Silence) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Start, End time.Time
		Alert      string
		Tags       string
		Forget     bool
	}{
		Start:  s.Start,
		End:    s.End,
		Alert:  s.Alert,
		Tags:   s.Tags.Tags(),
		Forget: s.Forget,
	})
}

func (s *Silence) Silenced(now time.Time, alert string, tags opentsdb.TagSet) bool {
	if now.Before(s.Start) || now.After(s.End) {
		return false
	}
	return s.Matches(alert, tags)
}

func (s *Silence) Matches(alert string, tags opentsdb.TagSet) bool {
	if s.Alert != "" && s.Alert != alert {
		return false
	}
	for k, pattern := range s.Tags {
		tagv, ok := tags[k]
		if !ok {
			return false
		}
		matched, _ := Match(pattern, tagv)
		if !matched {
			return false
		}
	}
	return true
}

func (s Silence) ID() string {
	h := sha1.New()
	fmt.Fprintf(h, "%s|%s|%s%s", s.Start, s.End, s.Alert, s.Tags)
	return fmt.Sprintf("%x", h.Sum(nil))
}

// Silenced returns all currently silenced AlertKeys and the time they will be
// unsilenced.
func (s *Schedule) Silenced() map[expr.AlertKey]Silence {
	aks := make(map[expr.AlertKey]Silence)
	now := time.Now()
	s.Lock()
	for _, si := range s.Silence {
		for ak := range s.status {
			if si.Silenced(now, ak.Name(), ak.Group()) {
				if aks[ak].End.Before(si.End) {
					aks[ak] = *si
				}
			}
		}
	}
	s.Unlock()
	return aks
}

func (s *Schedule) AddSilence(start, end time.Time, alert, tagList string, forget, confirm bool, edit string) (map[expr.AlertKey]bool, error) {
	if start.IsZero() || end.IsZero() {
		return nil, fmt.Errorf("both start and end must be specified")
	}
	if start.After(end) {
		return nil, fmt.Errorf("start time must be before end time")
	}
	if time.Since(end) > 0 {
		return nil, fmt.Errorf("end time must be in the future")
	}
	if alert == "" && tagList == "" {
		return nil, fmt.Errorf("must specify either alert or tags")
	}
	si := &Silence{
		Start:  start,
		End:    end,
		Alert:  alert,
		Tags:   make(opentsdb.TagSet),
		Forget: forget,
	}
	if tagList != "" {
		tags, err := opentsdb.ParseTags(tagList)
		if err != nil && tags == nil {
			return nil, err
		}
		si.Tags = tags
	}
	s.Lock()
	defer s.Unlock()
	if confirm {
		delete(s.Silence, edit)
		s.Silence[si.ID()] = si
		s.Save()
		return nil, nil
	}
	aks := make(map[expr.AlertKey]bool)
	for ak := range s.status {
		if si.Matches(ak.Name(), ak.Group()) {
			aks[ak] = s.status[ak].IsActive()
		}
	}
	return aks, nil
}

func (s *Schedule) ClearSilence(id string) error {
	s.Lock()
	delete(s.Silence, id)
	s.Unlock()
	s.Save()
	return nil
}
