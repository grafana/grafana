// Copyright 2012 Aaron Jacobs. All Rights Reserved.
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

package srcutil

import (
	"fmt"
	"reflect"
	"runtime"
	"sort"
)

func getLine(m reflect.Method) int {
	pc := m.Func.Pointer()

	f := runtime.FuncForPC(pc)
	if f == nil {
		panic(fmt.Sprintf("Couldn't get runtime func for method (pc=%d): %v", pc, m))
	}

	_, line := f.FileLine(pc)
	return line
}

type sortableMethodSet []reflect.Method

func (s sortableMethodSet) Len() int {
	return len(s)
}

func (s sortableMethodSet) Less(i, j int) bool {
	return getLine(s[i]) < getLine(s[j])
}

func (s sortableMethodSet) Swap(i, j int) {
	s[i], s[j] = s[j], s[i]
}

// Given a type t, return all of the methods of t sorted such that source file
// order is preserved. Order across files is undefined. Order within lines is
// undefined.
func GetMethodsInSourceOrder(t reflect.Type) []reflect.Method {
	// Build the list of methods.
	methods := sortableMethodSet{}
	for i := 0; i < t.NumMethod(); i++ {
		methods = append(methods, t.Method(i))
	}

	// Sort it.
	sort.Sort(methods)

	return methods
}
