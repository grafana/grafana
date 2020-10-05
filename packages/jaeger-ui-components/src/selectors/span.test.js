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

import * as spanSelectors from './span';
import traceGenerator from '../demo/trace-generators';

const generatedTrace = traceGenerator.trace({ numberOfSpans: 45 });

it('getSpanId() should return the name of the span', () => {
  const span = generatedTrace.spans[0];

  expect(spanSelectors.getSpanId(span)).toBe(span.spanID);
});

it('getSpanName() should return the name of the span', () => {
  const span = generatedTrace.spans[0];

  expect(spanSelectors.getSpanName(span)).toBe(span.operationName);
});

it('getSpanDuration() should return the duration of the span', () => {
  const span = generatedTrace.spans[0];

  expect(spanSelectors.getSpanDuration(span)).toBe(span.duration);
});

it('getSpanTimestamp() should return the timestamp of the span', () => {
  const span = generatedTrace.spans[0];

  expect(spanSelectors.getSpanTimestamp(span)).toBe(span.startTime);
});

it('getSpanReferences() should return the span reference array', () => {
  expect(spanSelectors.getSpanReferences(generatedTrace.spans[0])).toEqual(generatedTrace.spans[0].references);
});

it('getSpanReferences() should return empty array for null references', () => {
  expect(spanSelectors.getSpanReferences({ references: null })).toEqual([]);
});

it('getSpanReferenceByType() should return the span reference requested', () => {
  expect(
    spanSelectors.getSpanReferenceByType({
      span: generatedTrace.spans[1],
      type: 'CHILD_OF',
    }).refType
  ).toBe('CHILD_OF');
});

it('getSpanReferenceByType() should return undefined if one does not exist', () => {
  expect(
    spanSelectors.getSpanReferenceByType({
      span: generatedTrace.spans[0],
      type: 'FOLLOWS_FROM',
    })
  ).toBe(undefined);
});

it('getSpanParentId() should return the spanID of the parent span', () => {
  expect(spanSelectors.getSpanParentId(generatedTrace.spans[1])).toBe(
    generatedTrace.spans[1].references.find(({ refType }) => refType === 'CHILD_OF').spanID
  );
});

it('getSpanParentId() should return null if no CHILD_OF reference exists', () => {
  expect(spanSelectors.getSpanParentId(generatedTrace.spans[0])).toBe(null);
});

it('getSpanProcessId() should return the processID of the span', () => {
  const span = generatedTrace.spans[0];

  expect(spanSelectors.getSpanProcessId(span)).toBe(span.processID);
});

it('getSpanProcess() should return the process of the span', () => {
  const span = {
    ...generatedTrace.spans[0],
    process: {},
  };

  expect(spanSelectors.getSpanProcess(span)).toBe(span.process);
});

it('getSpanProcess() should throw if no process exists', () => {
  expect(() => spanSelectors.getSpanProcess(generatedTrace.spans[0])).toThrow();
});

it('getSpanServiceName() should return the service name of the span', () => {
  const serviceName = 'bagel';
  const span = {
    ...generatedTrace.spans[0],
    process: { serviceName },
  };

  expect(spanSelectors.getSpanServiceName(span)).toBe(serviceName);
});

it('filterSpansForTimestamps() should return a filtered list of spans between the times', () => {
  const now = new Date().getTime() * 1000;
  const spans = [
    {
      startTime: now - 1000,
      id: 'start-time-1',
    },
    {
      startTime: now,
      id: 'start-time-2',
    },
    {
      startTime: now + 1000,
      id: 'start-time-3',
    },
  ];

  expect(
    spanSelectors.filterSpansForTimestamps({
      spans,
      leftBound: now - 500,
      rightBound: now + 500,
    })
  ).toEqual([spans[1]]);

  expect(
    spanSelectors.filterSpansForTimestamps({
      spans,
      leftBound: now - 2000,
      rightBound: now + 2000,
    })
  ).toEqual([...spans]);

  expect(
    spanSelectors.filterSpansForTimestamps({
      spans,
      leftBound: now - 1000,
      rightBound: now,
    })
  ).toEqual([spans[0], spans[1]]);

  expect(
    spanSelectors.filterSpansForTimestamps({
      spans,
      leftBound: now,
      rightBound: now + 1000,
    })
  ).toEqual([spans[1], spans[2]]);
});

it('filterSpansForText() should return a filtered list of spans between the times', () => {
  const spans = [
    {
      operationName: 'GET /mything',
      process: {
        serviceName: 'alpha',
      },
      id: 'start-time-1',
    },
    {
      operationName: 'GET /another',
      process: {
        serviceName: 'beta',
      },
      id: 'start-time-1',
    },
    {
      operationName: 'POST /mything',
      process: {
        serviceName: 'alpha',
      },
      id: 'start-time-1',
    },
  ];

  expect(
    spanSelectors.filterSpansForText({
      spans,
      text: '/mything',
    })
  ).toEqual([spans[0], spans[2]]);

  expect(
    spanSelectors.filterSpansForText({
      spans,
      text: 'GET',
    })
  ).toEqual([spans[0], spans[1]]);

  expect(
    spanSelectors.filterSpansForText({
      spans,
      text: 'alpha',
    })
  ).toEqual([spans[0], spans[2]]);
});
