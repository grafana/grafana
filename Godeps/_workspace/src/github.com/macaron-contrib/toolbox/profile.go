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
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"runtime"
	"runtime/debug"
	"runtime/pprof"
	"time"

	"github.com/Unknwon/com"
	"github.com/Unknwon/macaron"
)

var (
	profilePath  string
	pid          int
	startTime    = time.Now()
	inCPUProfile bool
)

// StartCPUProfile starts CPU profile monitor.
func StartCPUProfile() error {
	if inCPUProfile {
		return errors.New("CPU profile has alreday been started!")
	}
	inCPUProfile = true

	f, err := os.Create(path.Join(profilePath, "cpu-"+com.ToStr(pid)+".pprof"))
	if err != nil {
		panic("fail to record CPU profile: " + err.Error())
	}
	pprof.StartCPUProfile(f)
	return nil
}

// StopCPUProfile stops CPU profile monitor.
func StopCPUProfile() error {
	if !inCPUProfile {
		return errors.New("CPU profile hasn't been started!")
	}
	pprof.StopCPUProfile()
	inCPUProfile = false
	return nil
}

func init() {
	pid = os.Getpid()
}

// DumpMemProf dumps memory profile in pprof.
func DumpMemProf(w io.Writer) {
	pprof.WriteHeapProfile(w)
}

func dumpMemProf() {
	os.MkdirAll(profilePath, os.ModePerm)
	f, err := os.Create(path.Join(profilePath, "mem-"+com.ToStr(pid)+".memprof"))
	if err != nil {
		panic("fail to record memory profile: " + err.Error())
	}
	runtime.GC()
	DumpMemProf(f)
	f.Close()
}

func avg(items []time.Duration) time.Duration {
	var sum time.Duration
	for _, item := range items {
		sum += item
	}
	return time.Duration(int64(sum) / int64(len(items)))
}

func dumpGC(memStats *runtime.MemStats, gcstats *debug.GCStats, w io.Writer) {

	if gcstats.NumGC > 0 {
		lastPause := gcstats.Pause[0]
		elapsed := time.Now().Sub(startTime)
		overhead := float64(gcstats.PauseTotal) / float64(elapsed) * 100
		allocatedRate := float64(memStats.TotalAlloc) / elapsed.Seconds()

		fmt.Fprintf(w, "NumGC:%d Pause:%s Pause(Avg):%s Overhead:%3.2f%% Alloc:%s Sys:%s Alloc(Rate):%s/s Histogram:%s %s %s \n",
			gcstats.NumGC,
			com.ToStr(lastPause),
			com.ToStr(avg(gcstats.Pause)),
			overhead,
			com.HumaneFileSize(memStats.Alloc),
			com.HumaneFileSize(memStats.Sys),
			com.HumaneFileSize(uint64(allocatedRate)),
			com.ToStr(gcstats.PauseQuantiles[94]),
			com.ToStr(gcstats.PauseQuantiles[98]),
			com.ToStr(gcstats.PauseQuantiles[99]))
	} else {
		// while GC has disabled
		elapsed := time.Now().Sub(startTime)
		allocatedRate := float64(memStats.TotalAlloc) / elapsed.Seconds()

		fmt.Fprintf(w, "Alloc:%s Sys:%s Alloc(Rate):%s/s\n",
			com.HumaneFileSize(memStats.Alloc),
			com.HumaneFileSize(memStats.Sys),
			com.HumaneFileSize(uint64(allocatedRate)))
	}
}

// DumpGCSummary dumps GC information to io.Writer
func DumpGCSummary(w io.Writer) {
	memStats := &runtime.MemStats{}
	runtime.ReadMemStats(memStats)
	gcstats := &debug.GCStats{PauseQuantiles: make([]time.Duration, 100)}
	debug.ReadGCStats(gcstats)

	dumpGC(memStats, gcstats, w)
}

func handleProfile(ctx *macaron.Context) string {
	switch ctx.Query("op") {
	case "startcpu":
		if err := StartCPUProfile(); err != nil {
			return err.Error()
		}
	case "stopcpu":
		if err := StopCPUProfile(); err != nil {
			return err.Error()
		}
	case "mem":
		dumpMemProf()
	case "gc":
		var buf bytes.Buffer
		DumpGCSummary(&buf)
		return string(buf.Bytes())
	default:
		return fmt.Sprintf(`<p>Available operations:</p>
<ol>
	<li><a href="%s?op=startcpu">Start CPU profile</a></li>
	<li><a href="%s?op=stopcpu">Stop CPU profile</a></li>
	<li><a href="%s?op=mem">Dump memory profile</a></li>
	<li><a href="%s?op=gc">Dump GC summary</a></li>
</ol>`, opt.ProfileURLPrefix, opt.ProfileURLPrefix, opt.ProfileURLPrefix, opt.ProfileURLPrefix)
	}
	ctx.Redirect(opt.ProfileURLPrefix)
	return ""
}
