package sched

import (
	"bytes"
	"fmt"
	"log"
	"text/template"
	"time"

	"bosun.org/cmd/bosun/conf"
	"bosun.org/cmd/bosun/expr"
)

// Poll dispatches notification checks when needed.
func (s *Schedule) Poll() {
	for {
		timeout := s.CheckNotifications()
		s.Save()
		// Wait for one of these two.
		select {
		case <-time.After(timeout):
		case <-s.nc:
		}
	}
}

func (s *Schedule) Notify(st *State, n *conf.Notification) {
	if s.notifications == nil {
		s.notifications = make(map[*conf.Notification][]*State)
	}
	s.notifications[n] = append(s.notifications[n], st)
}

// CheckNotifications processes past notification events. It returns the
// duration until the soonest notification triggers.
func (s *Schedule) CheckNotifications() time.Duration {
	silenced := s.Silenced()
	s.Lock()
	defer s.Unlock()
	notifications := s.Notifications
	s.Notifications = nil
	for ak, ns := range notifications {
		if _, present := silenced[ak]; present {
			log.Println("silencing", ak)
			continue
		}
		for name, t := range ns {
			n, present := s.Conf.Notifications[name]
			if !present {
				continue
			}
			remaining := t.Add(n.Timeout).Sub(time.Now())
			if remaining > 0 {
				s.AddNotification(ak, n, t)
				continue
			}
			st := s.status[ak]
			if st == nil {
				continue
			}
			// If alert is currently unevaluated because of a dependency,
			// simply requeue it until the dependency resolves itself.
			if st.Unevaluated {
				s.AddNotification(ak, n, t)
				continue
			}
			s.Notify(st, n)
		}
	}
	s.sendNotifications(silenced)
	s.notifications = nil
	timeout := time.Hour
	now := time.Now()
	for _, ns := range s.Notifications {
		for name, t := range ns {
			n, present := s.Conf.Notifications[name]
			if !present {
				continue
			}
			remaining := t.Add(n.Timeout).Sub(now)
			if remaining < timeout {
				timeout = remaining
			}
		}
	}
	return timeout
}

func (s *Schedule) sendNotifications(silenced map[expr.AlertKey]Silence) {
	if s.Conf.Quiet {
		log.Println("quiet mode prevented", len(s.notifications), "notifications")
		return
	}
	for n, states := range s.notifications {
		ustates := make(States)
		for _, st := range states {
			ak := st.AlertKey()
			_, silenced := silenced[ak]
			if st.Last().Status == StUnknown {
				if silenced {
					log.Println("silencing unknown", ak)
					continue
				}
				ustates[ak] = st
			} else if silenced {
				log.Println("silencing", ak)
			} else {
				s.notify(st, n)
			}
			if n.Next != nil {
				s.AddNotification(ak, n.Next, time.Now().UTC())
			}
		}
		var c int
		tHit := false
		oTSets := make(map[string]expr.AlertKeys)
		groupSets := ustates.GroupSets()
		for name, group := range groupSets {
			c++
			if c >= s.Conf.UnknownThreshold && s.Conf.UnknownThreshold > 0 {
				if !tHit && len(groupSets) == 0 {
					// If the threshold is hit but only 1 email remains, just send the normal unknown
					s.unotify(name, group, n)
					break
				}
				tHit = true
				oTSets[name] = group
			} else {
				s.unotify(name, group, n)
			}
		}
		if len(oTSets) > 0 {
			s.utnotify(oTSets, n)
		}
	}
}

var unknownMultiGroup = template.Must(template.New("unknownMultiGroup").Parse(`
	<p>Threshold of {{ .Threshold }} reached for unknown notifications. The following unknown
	group emails were not sent.
	<ul>
	{{ range $group, $alertKeys := .Groups }}
		<li>
			{{ $group }}
			<ul>
				{{ range $ak := $alertKeys }}
				<li>{{ $ak }}</li>
				{{ end }}
			<ul>
		</li>
	{{ end }}
	</ul>
	`))

func (s *Schedule) notify(st *State, n *conf.Notification) {
	n.Notify(st.Subject, st.Body, st.EmailSubject, st.EmailBody, s.Conf, string(st.AlertKey()), st.Attachments...)
}

// utnotify is single notification for N unknown groups into a single notification
func (s *Schedule) utnotify(groups map[string]expr.AlertKeys, n *conf.Notification) {
	var total int
	now := time.Now().UTC()
	for _, group := range groups {
		// Don't know what the following line does, just copied from unotify
		s.Group[now] = group
		total += len(group)
	}
	subject := fmt.Sprintf("%v unknown alert instances suppressed", total)
	body := new(bytes.Buffer)
	if err := unknownMultiGroup.Execute(body, struct {
		Groups    map[string]expr.AlertKeys
		Threshold int
	}{
		groups,
		s.Conf.UnknownThreshold,
	}); err != nil {
		log.Println(err)
	}
	n.Notify(subject, body.String(), []byte(subject), body.Bytes(), s.Conf, "unknown_treshold")
}

func (s *Schedule) unotify(name string, group expr.AlertKeys, n *conf.Notification) {
	subject := new(bytes.Buffer)
	body := new(bytes.Buffer)
	now := time.Now().UTC()
	s.Group[now] = group
	if t := s.Conf.UnknownTemplate; t != nil {
		data := s.unknownData(now, name, group)
		if t.Body != nil {
			if err := t.Body.Execute(body, &data); err != nil {
				log.Println("unknown template error:", err)
			}
		}
		if t.Subject != nil {
			if err := t.Subject.Execute(subject, &data); err != nil {
				log.Println("unknown template error:", err)
			}
		}
	}
	n.Notify(subject.String(), body.String(), subject.Bytes(), body.Bytes(), s.Conf, name)
}

func (s *Schedule) AddNotification(ak expr.AlertKey, n *conf.Notification, started time.Time) {
	if s.Notifications == nil {
		s.Notifications = make(map[expr.AlertKey]map[string]time.Time)
	}
	if s.Notifications[ak] == nil {
		s.Notifications[ak] = make(map[string]time.Time)
	}
	s.Notifications[ak][n.Name] = started
}
