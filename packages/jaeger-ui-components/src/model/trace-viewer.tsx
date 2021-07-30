// Copyright (c) 2020 The Jaeger Authors
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

import { TraceSpan } from '../types/trace';

type spansDict = { [index: string]: TraceSpan };

export function getTraceName(spans: TraceSpan[]) {
  const allTraceSpans: spansDict = spans.reduce((dict, span) => ({ ...dict, [span.spanID]: span }), {});
  const rootSpan = spans
    .filter((sp) => {
      if (!sp.references || !sp.references.length) {
        return true;
      }
      const parentIDs = sp.references.filter((r) => r.traceID === sp.traceID).map((r) => r.spanID);

      // returns true if no parent from this trace found
      return !parentIDs.some((pID) => Boolean(allTraceSpans[pID]));
    })
    .sort((sp1, sp2) => {
      const sp1ParentsNum = sp1.references ? sp1.references.length : 0;
      const sp2ParentsNum = sp2.references ? sp2.references.length : 0;

      return sp1ParentsNum - sp2ParentsNum || sp1.startTime - sp2.startTime;
    })[0];

  return rootSpan ? `${rootSpan.process.serviceName}: ${rootSpan.operationName}` : '';
}
