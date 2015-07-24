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
)

// HealthChecker represents a health check instance.
type HealthChecker interface {
	Desc() string
	Check() error
}

// HealthCheckFunc represents a callable function for health check.
type HealthCheckFunc func() error

// HealthCheckFunc represents a callable function for health check with description.
type HealthCheckFuncDesc struct {
	Desc string
	Func HealthCheckFunc
}

type healthCheck struct {
	desc string
	HealthChecker
	check HealthCheckFunc // Not nil if add job as a function.
}

// AddHealthCheck adds new health check job.
func (t *toolbox) AddHealthCheck(hc HealthChecker) {
	t.healthCheckJobs = append(t.healthCheckJobs, &healthCheck{
		HealthChecker: hc,
	})
}

// AddHealthCheckFunc adds a function as a new health check job.
func (t *toolbox) AddHealthCheckFunc(desc string, fn HealthCheckFunc) {
	t.healthCheckJobs = append(t.healthCheckJobs, &healthCheck{
		desc:  desc,
		check: fn,
	})
}

func (t *toolbox) handleHealthCheck() string {
	if len(t.healthCheckJobs) == 0 {
		return "no health check jobs"
	}

	var buf bytes.Buffer
	var err error
	for _, job := range t.healthCheckJobs {
		buf.WriteString("* ")
		if job.check != nil {
			buf.WriteString(job.desc)
			err = job.check()
		} else {
			buf.WriteString(job.Desc())
			err = job.Check()
		}
		buf.WriteString(": ")
		if err == nil {
			buf.WriteString("OK")
		} else {
			buf.WriteString(err.Error())
		}
		buf.WriteString("\n")
	}
	return buf.String()
}
