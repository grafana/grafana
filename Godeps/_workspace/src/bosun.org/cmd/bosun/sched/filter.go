package sched

import (
	"fmt"
	"strings"

	"bosun.org/cmd/bosun/conf"
)

func makeFilter(filter string) (func(*conf.Conf, *conf.Alert, *State) bool, error) {
	fields := strings.Fields(filter)
	if len(fields) == 0 {
		return func(c *conf.Conf, a *conf.Alert, s *State) bool {
			return true
		}, nil
	}
	fs := make(map[string][]func(c *conf.Conf, a *conf.Alert, s *State) bool)
	for _, f := range fields {
		negate := strings.HasPrefix(f, "!")
		if negate {
			f = f[1:]
		}
		if f == "" {
			return nil, fmt.Errorf("filter required")
		}
		sp := strings.SplitN(f, ":", 2)
		value := sp[len(sp)-1]
		key := sp[0]
		if len(sp) == 1 {
			key = ""
		}
		add := func(fn func(c *conf.Conf, a *conf.Alert, s *State) bool) {
			fs[key] = append(fs[key], func(c *conf.Conf, a *conf.Alert, s *State) bool {
				v := fn(c, a, s)
				if negate {
					v = !v
				}
				return v
			})
		}
		switch key {
		case "":
			add(func(c *conf.Conf, a *conf.Alert, s *State) bool {
				ak := s.AlertKey()
				return strings.Contains(string(ak), value) || strings.Contains(string(s.Subject), value)
			})
		case "ack":
			var v bool
			switch value {
			case "true":
				v = true
			case "false":
				v = false
			default:
				return nil, fmt.Errorf("unknown %s value: %s", key, value)
			}
			add(func(c *conf.Conf, a *conf.Alert, s *State) bool {
				return s.NeedAck != v
			})
		case "notify":
			add(func(c *conf.Conf, a *conf.Alert, s *State) bool {
				r := false
				f := func(ns *conf.Notifications) {
					for k := range ns.Get(c, s.Group) {
						if strings.Contains(k, value) {
							r = true
							break
						}
					}
				}
				f(a.CritNotification)
				f(a.WarnNotification)
				return r
			})
		case "status":
			var v Status
			switch value {
			case "normal":
				v = StNormal
			case "warning":
				v = StWarning
			case "critical":
				v = StCritical
			case "error":
				v = StError
			case "unknown":
				v = StUnknown
			default:
				return nil, fmt.Errorf("unknown %s value: %s", key, value)
			}
			add(func(c *conf.Conf, a *conf.Alert, s *State) bool {
				return s.AbnormalStatus() == v
			})
		default:
			return nil, fmt.Errorf("unknown filter key: %s", key)
		}
	}
	return func(c *conf.Conf, a *conf.Alert, s *State) bool {
		for _, ors := range fs {
			match := false
			for _, f := range ors {
				if f(c, a, s) {
					match = true
					break
				}
			}
			if !match {
				return false
			}
		}
		return true
	}, nil
}
