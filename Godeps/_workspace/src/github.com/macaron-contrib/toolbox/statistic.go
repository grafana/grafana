// Copyright 2013 Beego Authors
// Copyright 2014 Unknwon
//
// Licensed under the Apache License, Version 2.0 (the "License"): you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.

package toolbox

import (
	"fmt"
	"io"
	"strings"
	"sync"
	"time"
)

// Statistics struct
type Statistics struct {
	RequestUrl string
	RequestNum int64
	MinTime    time.Duration
	MaxTime    time.Duration
	TotalTime  time.Duration
}

// UrlMap contains several statistics struct to log different data
type UrlMap struct {
	lock        sync.RWMutex
	LengthLimit int // limit the urlmap's length if it's equal to 0 there's no limit
	urlmap      map[string]map[string]*Statistics
}

// add statistics task.
// it needs request method, request url and statistics time duration
func (m *UrlMap) AddStatistics(requestMethod, requestUrl string, requesttime time.Duration) {
	m.lock.Lock()
	defer m.lock.Unlock()

	if method, ok := m.urlmap[requestUrl]; ok {
		if s, ok := method[requestMethod]; ok {
			s.RequestNum += 1
			if s.MaxTime < requesttime {
				s.MaxTime = requesttime
			}
			if s.MinTime > requesttime {
				s.MinTime = requesttime
			}
			s.TotalTime += requesttime
		} else {
			nb := &Statistics{
				RequestUrl: requestUrl,
				RequestNum: 1,
				MinTime:    requesttime,
				MaxTime:    requesttime,
				TotalTime:  requesttime,
			}
			m.urlmap[requestUrl][requestMethod] = nb
		}

	} else {
		if m.LengthLimit > 0 && m.LengthLimit <= len(m.urlmap) {
			return
		}
		methodmap := make(map[string]*Statistics)
		nb := &Statistics{
			RequestUrl: requestUrl,
			RequestNum: 1,
			MinTime:    requesttime,
			MaxTime:    requesttime,
			TotalTime:  requesttime,
		}
		methodmap[requestMethod] = nb
		m.urlmap[requestUrl] = methodmap
	}
}

// put url statistics result in io.Writer
func (m *UrlMap) GetMap(w io.Writer) {
	m.lock.RLock()
	defer m.lock.RUnlock()

	sep := fmt.Sprintf("+%s+%s+%s+%s+%s+%s+%s+\n", strings.Repeat("-", 51), strings.Repeat("-", 12),
		strings.Repeat("-", 18), strings.Repeat("-", 18), strings.Repeat("-", 18), strings.Repeat("-", 18), strings.Repeat("-", 18))
	fmt.Fprintf(w, sep)
	fmt.Fprintf(w, "| % -50s| % -10s | % -16s | % -16s | % -16s | % -16s | % -16s |\n", "Request URL", "Method", "Times", "Total Used(s)", "Max Used(μs)", "Min Used(μs)", "Avg Used(μs)")
	fmt.Fprintf(w, sep)

	for k, v := range m.urlmap {
		for kk, vv := range v {
			fmt.Fprintf(w, "| % -50s| % -10s | % 16d | % 16f | % 16.6f | % 16.6f | % 16.6f |\n", k,
				kk, vv.RequestNum, vv.TotalTime.Seconds(), float64(vv.MaxTime.Nanoseconds())/1000,
				float64(vv.MinTime.Nanoseconds())/1000, float64(time.Duration(int64(vv.TotalTime)/vv.RequestNum).Nanoseconds())/1000,
			)
		}
	}
	fmt.Fprintf(w, sep)
}
