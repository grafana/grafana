// Copyright (c) 2017 Uber Technologies, Inc.
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
import traceGenerator from '../demo/trace-generators';
import { TraceProcess } from '../types/trace';

import * as processSelectors from './process';

const generatedTrace = traceGenerator.trace({ numberOfSpans: 45 });

it('getProcessServiceName() should return the serviceName of the process', () => {
  const proc: TraceProcess = generatedTrace.processes[Object.keys(generatedTrace.processes)[0]];
  expect(processSelectors.getProcessServiceName(proc)).toBe(proc.serviceName);
});

it('getProcessTags() should return the tags on the process', () => {
  const proc: TraceProcess = generatedTrace.processes[Object.keys(generatedTrace.processes)[0]];
  expect(processSelectors.getProcessTags(proc)).toBe(proc.tags);
});
