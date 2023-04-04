// Copyright (c) 2019 Uber Technologies, Inc.
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

import { TraceSpan } from '../types';

import filterSpans from './filter-spans';

describe('filterSpans', () => {
  // span0 contains strings that end in 0 or 1
  const spanID0 = 'span-id-0';
  const span0 = {
    spanID: spanID0,
    operationName: 'operationName0',
    process: {
      serviceName: 'serviceName0',
      tags: [
        {
          key: 'processTagKey0',
          value: 'processTagValue0',
        },
        {
          key: 'processTagKey1',
          value: 'processTagValue1',
        },
      ],
    },
    tags: [
      {
        key: 'tagKey0',
        value: 'tagValue0',
      },
      {
        key: 'tagKey1',
        value: 'tagValue1',
      },
    ],
    logs: [
      {
        fields: [
          {
            key: 'logFieldKey0',
            value: 'logFieldValue0',
          },
          {
            key: 'logFieldKey1',
            value: 'logFieldValue1',
          },
        ],
      },
    ],
  } as TraceSpan;
  // span2 contains strings that end in 1 or 2, for overlap with span0
  // KVs in span2 have different numbers for key and value to facilitate excludesKey testing
  const spanID2 = 'span-id-2';
  const span2 = {
    spanID: spanID2,
    operationName: 'operationName2',
    process: {
      serviceName: 'serviceName2',
      tags: [
        {
          key: 'processTagKey2',
          value: 'processTagValue1',
        },
        {
          key: 'processTagKey1',
          value: 'processTagValue2',
        },
      ],
    },
    tags: [
      {
        key: 'tagKey2',
        value: 'tagValue1',
      },
      {
        key: 'tagKey1',
        value: 'tagValue2',
      },
    ],
    logs: [
      {
        fields: [
          {
            key: 'logFieldKey2',
            value: 'logFieldValue1',
          },
          {
            key: 'logFieldKey1',
            value: 'logFieldValue2',
          },
        ],
      },
    ],
  };
  const spans = [span0, span2] as TraceSpan[];

  it('should return `undefined` if spans is falsy', () => {
    expect(filterSpans('operationName', null)).toBe(undefined);
  });

  it('should return spans whose spanID exactly match a filter', () => {
    expect(filterSpans('spanID', spans)).toEqual(new Set([]));
    expect(filterSpans(spanID0, spans)).toEqual(new Set([spanID0]));
    expect(filterSpans(spanID2, spans)).toEqual(new Set([spanID2]));
  });

  it('should return spans whose operationName match a filter', () => {
    expect(filterSpans('operationName', spans)).toEqual(new Set([spanID0, spanID2]));
    expect(filterSpans('operationName0', spans)).toEqual(new Set([spanID0]));
    expect(filterSpans('operationName2', spans)).toEqual(new Set([spanID2]));
  });

  it('should return spans whose serviceName match a filter', () => {
    expect(filterSpans('serviceName', spans)).toEqual(new Set([spanID0, spanID2]));
    expect(filterSpans('serviceName0', spans)).toEqual(new Set([spanID0]));
    expect(filterSpans('serviceName2', spans)).toEqual(new Set([spanID2]));
  });

  it("should return spans whose tags' kv.key match a filter", () => {
    expect(filterSpans('tagKey1', spans)).toEqual(new Set([spanID0, spanID2]));
    expect(filterSpans('tagKey0', spans)).toEqual(new Set([spanID0]));
    expect(filterSpans('tagKey2', spans)).toEqual(new Set([spanID2]));
  });

  it("should return spans whose tags' kv.value match a filter", () => {
    expect(filterSpans('tagValue1', spans)).toEqual(new Set([spanID0, spanID2]));
    expect(filterSpans('tagValue0', spans)).toEqual(new Set([spanID0]));
    expect(filterSpans('tagValue2', spans)).toEqual(new Set([spanID2]));
  });

  it("should exclude span whose tags' kv.value or kv.key match a filter if the key matches an excludeKey", () => {
    expect(filterSpans('tagValue1 -tagKey2', spans)).toEqual(new Set([spanID0]));
    expect(filterSpans('tagValue1 -tagKey1', spans)).toEqual(new Set([spanID2]));
  });

  it('should return spans whose logs have a field whose kv.key match a filter', () => {
    expect(filterSpans('logFieldKey1', spans)).toEqual(new Set([spanID0, spanID2]));
    expect(filterSpans('logFieldKey0', spans)).toEqual(new Set([spanID0]));
    expect(filterSpans('logFieldKey2', spans)).toEqual(new Set([spanID2]));
  });

  it('should return spans whose logs have a field whose kv.value match a filter', () => {
    expect(filterSpans('logFieldValue1', spans)).toEqual(new Set([spanID0, spanID2]));
    expect(filterSpans('logFieldValue0', spans)).toEqual(new Set([spanID0]));
    expect(filterSpans('logFieldValue2', spans)).toEqual(new Set([spanID2]));
  });

  it('should exclude span whose logs have a field whose kv.value or kv.key match a filter if the key matches an excludeKey', () => {
    expect(filterSpans('logFieldValue1 -logFieldKey2', spans)).toEqual(new Set([spanID0]));
    expect(filterSpans('logFieldValue1 -logFieldKey1', spans)).toEqual(new Set([spanID2]));
  });

  it("should return spans whose process.tags' kv.key match a filter", () => {
    expect(filterSpans('processTagKey1', spans)).toEqual(new Set([spanID0, spanID2]));
    expect(filterSpans('processTagKey0', spans)).toEqual(new Set([spanID0]));
    expect(filterSpans('processTagKey2', spans)).toEqual(new Set([spanID2]));
  });

  it("should return spans whose process.processTags' kv.value match a filter", () => {
    expect(filterSpans('processTagValue1', spans)).toEqual(new Set([spanID0, spanID2]));
    expect(filterSpans('processTagValue0', spans)).toEqual(new Set([spanID0]));
    expect(filterSpans('processTagValue2', spans)).toEqual(new Set([spanID2]));
  });

  it("should exclude span whose process.processTags' kv.value or kv.key match a filter if the key matches an excludeKey", () => {
    expect(filterSpans('processTagValue1 -processTagKey2', spans)).toEqual(new Set([spanID0]));
    expect(filterSpans('processTagValue1 -processTagKey1', spans)).toEqual(new Set([spanID2]));
  });

  // This test may false positive if other tests are failing
  it('should return an empty set if no spans match the filter', () => {
    expect(filterSpans('-processTagKey1', spans)).toEqual(new Set());
  });

  it('should return no spans when logs is null', () => {
    const nullSpan = { ...span0, logs: null };
    expect(filterSpans('logFieldKey1', [nullSpan] as unknown as TraceSpan[])).toEqual(new Set([]));
  });
});
