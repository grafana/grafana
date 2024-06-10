// Copyright (c) 2023 The Jaeger Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import test1 from './testCases/test1';
import test2 from './testCases/test2';
import test3 from './testCases/test3';
import test4 from './testCases/test4';
import test5 from './testCases/test5';
import test6 from './testCases/test6';
import test7 from './testCases/test7';
import test8 from './testCases/test8';
import test9 from './testCases/test9';

import TraceCriticalPath from './index';

describe.each([[test1], [test2], [test3], [test4], [test5], [test6], [test7], [test8], [test9]])(
  'Happy Path',
  (testProps) => {
    it('should find criticalPathSections correctly', () => {
      const criticalPath = TraceCriticalPath(testProps.trace);
      expect(criticalPath).toStrictEqual(testProps.criticalPathSections);
    });
  }
);
