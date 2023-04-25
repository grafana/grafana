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

import Chance from 'chance';

import {
  TraceSpanData,
  TraceProcess,
  TraceKeyValuePair,
  TraceResponse,
} from 'app/features/explore/TraceView/components/types/trace';

import { getSpanId } from '../selectors/span';

interface Process extends TraceProcess {
  processID: string;
}

interface ChanceSpanOptions {
  traceID?: string;
  processes?: Record<string, unknown>;
  traceStartTime?: number;
  traceEndTime?: number;
  operations?: string[];
}

interface ChanceTraceOptions {
  numberOfSpans?: number;
  numberOfProcesses?: number;
  maxDepth?: number;
  spansPerLevel?: number | null;
}

interface ChanceTracesOptions {
  numberOfTraces?: number;
}

interface ChanceProcessOptions {
  services?: string[];
}

interface ChanceProcessesOptions {
  numberOfProcesses?: number;
}

interface ChanceMixins {
  tag(): TraceKeyValuePair;
  tags(): TraceKeyValuePair[];

  span(options: ChanceSpanOptions): TraceSpanData;

  trace(options: ChanceTraceOptions): TraceResponse;
  traces(options: ChanceTracesOptions): TraceResponse[];

  process(options: ChanceProcessOptions): Process;
  processes(options: ChanceProcessesOptions): Process[];
}

// Difficult to extend Chance interface with our mixins, so we just steam roll them in instead
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const chance = new Chance() as Chance.Chance & ChanceMixins;

export const SERVICE_LIST = ['serviceA', 'serviceB', 'serviceC', 'serviceD', 'serviceE', 'serviceF'];
export const OPERATIONS_LIST = [
  'GET',
  'PUT',
  'POST',
  'DELETE',
  'MySQL::SELECT',
  'MySQL::INSERT',
  'MongoDB::find',
  'MongoDB::update',
];

function setupParentSpan(spans: TraceSpanData[], parentSpanValues: TraceSpanData) {
  Object.assign(spans[0], parentSpanValues);
  return spans;
}

function getParentSpanId(span: TraceSpanData, levels: string[][]) {
  let nestingLevel = chance.integer({ min: 1, max: levels.length });

  // pick the correct nesting level if allocated by the levels calculation
  levels.forEach((level, idx) => {
    if (level.indexOf(getSpanId(span)) >= 0) {
      nestingLevel = idx;
    }
  });

  return nestingLevel - 1 >= 0 ? chance.pickone(levels[nestingLevel - 1]) : null;
}

/* this simulates the hierarchy created by CHILD_OF tags */
function attachReferences(spans: TraceSpanData[], depth: number, spansPerLevel: number | null) {
  let levels: string[][] = [[getSpanId(spans[0])]];

  const duplicateLevelFilter = (currentLevels: string[][]) => (span: TraceSpanData) =>
    !currentLevels.find((level) => level.indexOf(span.spanID) >= 0);

  while (levels.length < depth) {
    const remainingSpans = spans.filter(duplicateLevelFilter(levels));
    if (remainingSpans.length <= 0) {
      break;
    }

    const newLevel = chance.pickset(remainingSpans, spansPerLevel || chance.integer({ min: 4, max: 8 })).map(getSpanId);
    levels.push(newLevel);
  }

  // filter out empty levels
  levels = levels.filter((level) => level.length > 0);

  return spans.map((span) => {
    const parentSpanId = getParentSpanId(span, levels);
    return parentSpanId
      ? {
          ...span,
          references: [
            {
              refType: 'CHILD_OF' as const,
              traceID: span.traceID,
              spanID: parentSpanId,
            },
          ],
        }
      : span;
  });
}

export default chance.mixin({
  trace({
    // long trace
    // very short trace
    // average case
    numberOfSpans = chance.pickone([
      Math.ceil(chance.normal({ mean: 200, dev: 10 })) + 1,
      Math.ceil(chance.integer({ min: 3, max: 10 })),
      Math.ceil(chance.normal({ mean: 45, dev: 15 })) + 1,
    ]),
    numberOfProcesses = chance.integer({ min: 1, max: 10 }),
    maxDepth = chance.integer({ min: 1, max: 10 }),
    spansPerLevel = null,
  }: ChanceTraceOptions) {
    const traceID = chance.guid();
    const duration: number = chance.integer({ min: 10000, max: 5000000 });
    const timestamp = (new Date().getTime() - chance.integer({ min: 0, max: 1000 }) * 1000) * 1000;

    const processArray: Process[] = chance.processes({ numberOfProcesses });
    const processes = processArray.reduce((pMap, p) => ({ ...pMap, [p.processID]: p }), {});

    let spans = chance.n(chance.span, numberOfSpans, {
      traceID,
      processes,
      traceStartTime: timestamp,
      traceEndTime: timestamp + duration,
    });
    spans = attachReferences(spans, maxDepth, spansPerLevel);
    if (spans.length > 1) {
      spans = setupParentSpan(spans, { startTime: timestamp, duration } as TraceSpanData);
    }

    return {
      traceID,
      spans,
      processes,
    };
  },

  tag() {
    return {
      key: 'http.url',
      type: 'String',
      value: `/v2/${chance.pickone(['alpha', 'beta', 'gamma'])}/${chance.guid()}`,
    };
  },

  span({
    traceID = chance.guid(),
    processes = {},
    traceStartTime = 0,
    traceEndTime = 0,
    operations = OPERATIONS_LIST,
  }: ChanceSpanOptions) {
    // Set default values for trace start/end time.
    traceStartTime = traceStartTime || chance.timestamp() * 1000 * 1000;
    traceEndTime = traceEndTime || traceStartTime + 100000;

    const startTime = chance.integer({
      min: traceStartTime,
      max: traceEndTime,
    });

    const maxDuration = traceEndTime - startTime;

    return {
      traceID,
      processID: chance.pickone(Object.keys(processes)),
      spanID: chance.guid(),
      flags: 0,
      operationName: chance.pickone(operations),
      references: [],
      startTime,
      duration: chance.integer({ min: 1, max: maxDuration <= 1 ? 2 : maxDuration }),
      tags: chance.tags(),
      logs: [],
    };
  },

  process({ services = SERVICE_LIST }: ChanceProcessOptions) {
    return {
      processID: chance.guid(),
      serviceName: chance.pickone(services),
      tags: chance.tags(),
    };
  },

  traces({ numberOfTraces = chance.integer({ min: 5, max: 15 }) }: ChanceTracesOptions) {
    return chance.n(chance.trace, numberOfTraces, {});
  },

  tags() {
    return chance.n(chance.tag, chance.integer({ min: 1, max: 10 }), {});
  },

  processes({ numberOfProcesses = chance.integer({ min: 1, max: 25 }) }: ChanceProcessesOptions) {
    return chance.n(chance.process, numberOfProcesses, {});
  },
});
