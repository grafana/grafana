// Copyright 2015 Aaron Jacobs. All Rights Reserved.
// Author: aaronjjacobs@gmail.com (Aaron Jacobs)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package oglemock

import (
	"fmt"
	"reflect"
)

// Create an Action that invokes the supplied actions one after another. The
// return values from the final action are used; others are ignored.
func DoAll(first Action, others ...Action) Action {
	return &doAll{
		wrapped: append([]Action{first}, others...),
	}
}

type doAll struct {
	wrapped []Action
}

func (a *doAll) SetSignature(signature reflect.Type) (err error) {
	for i, w := range a.wrapped {
		err = w.SetSignature(signature)
		if err != nil {
			err = fmt.Errorf("Action %v: %v", i, err)
			return
		}
	}

	return
}

func (a *doAll) Invoke(methodArgs []interface{}) (rets []interface{}) {
	for _, w := range a.wrapped {
		rets = w.Invoke(methodArgs)
	}

	return
}
