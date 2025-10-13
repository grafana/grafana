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

import { defaultFilters, defaultTagFilter } from '../../useSearch';
import { TraceSpan } from '../types';

import { filterSpans } from './filter-spans';

describe('filterSpans', () => {
  // span0 contains strings that end in 0 or 1
  const spanID0 = 'span-id-0';
  const span0 = {
    spanID: spanID0,
    operationName: 'operationName0',
    duration: 3050,
    kind: 'kind0',
    statusCode: 0,
    statusMessage: 'statusMessage0',
    instrumentationLibraryName: 'libraryName',
    instrumentationLibraryVersion: 'libraryVersion0',
    traceState: 'traceState0',
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
        name: 'logName0',
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
    duration: 5000,
    kind: 'kind2',
    statusCode: 2,
    statusMessage: 'statusMessage2',
    instrumentationLibraryName: 'libraryName',
    instrumentationLibraryVersion: 'libraryVersion2',
    traceState: 'traceState2',
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
    expect(filterSpans({ ...defaultFilters, spanName: 'operationName' }, null)).toBe(undefined);
  });

  // Service / span name
  it('should return spans whose serviceName match a filter', () => {
    expect(filterSpans({ ...defaultFilters, serviceName: 'serviceName0' }, spans)).toEqual(new Set([spanID0]));
    expect(filterSpans({ ...defaultFilters, serviceName: 'serviceName2' }, spans)).toEqual(new Set([spanID2]));
    expect(filterSpans({ ...defaultFilters, serviceName: 'serviceName2', serviceNameOperator: '!=' }, spans)).toEqual(
      new Set([spanID0])
    );
  });

  it('should return spans whose operationName match a filter', () => {
    expect(filterSpans({ ...defaultFilters, spanName: 'operationName0' }, spans)).toEqual(new Set([spanID0]));
    expect(filterSpans({ ...defaultFilters, spanName: 'operationName2' }, spans)).toEqual(new Set([spanID2]));
    expect(filterSpans({ ...defaultFilters, spanName: 'operationName2', spanNameOperator: '!=' }, spans)).toEqual(
      new Set([spanID0])
    );
  });

  // Durations
  it('should return spans whose duration match a filter', () => {
    expect(filterSpans({ ...defaultFilters, from: '2ns' }, spans)).toEqual(new Set([spanID0, spanID2]));
    expect(filterSpans({ ...defaultFilters, from: '2us' }, spans)).toEqual(new Set([spanID0, spanID2]));
    expect(filterSpans({ ...defaultFilters, from: '2ms' }, spans)).toEqual(new Set([spanID0, spanID2]));
    expect(filterSpans({ ...defaultFilters, from: '3.05ms' }, spans)).toEqual(new Set([spanID2]));
    expect(filterSpans({ ...defaultFilters, from: '3.05ms', fromOperator: '>=' }, spans)).toEqual(
      new Set([spanID0, spanID2])
    );
    expect(filterSpans({ ...defaultFilters, from: '3.05ms', fromOperator: '>=', to: '4ms' }, spans)).toEqual(
      new Set([spanID0])
    );
    expect(filterSpans({ ...defaultFilters, to: '4ms' }, spans)).toEqual(new Set([spanID0]));
    expect(filterSpans({ ...defaultFilters, to: '5ms', toOperator: '<=' }, spans)).toEqual(new Set([spanID0, spanID2]));
  });

  // Tags
  it('should return spans whose tags kv.key match a filter', () => {
    expect(filterSpans({ ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'tagKey1' }] }, spans)).toEqual(
      new Set([spanID0, spanID2])
    );
    expect(filterSpans({ ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'tagKey0' }] }, spans)).toEqual(
      new Set([spanID0])
    );
    expect(filterSpans({ ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'tagKey2' }] }, spans)).toEqual(
      new Set([spanID2])
    );
    expect(
      filterSpans({ ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'tagKey2', operator: '!=' }] }, spans)
    ).toEqual(new Set([spanID0]));
  });

  it('should return spans whose kind, statusCode, statusMessage, libraryName, libraryVersion, traceState, or id match a filter', () => {
    expect(filterSpans({ ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'kind' }] }, spans)).toEqual(
      new Set([spanID0, spanID2])
    );
    expect(
      filterSpans({ ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'kind', value: 'kind0' }] }, spans)
    ).toEqual(new Set([spanID0]));
    expect(
      filterSpans(
        { ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'kind', operator: '!=', value: 'kind0' }] },
        spans
      )
    ).toEqual(new Set([spanID2]));
    expect(filterSpans({ ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'status' }] }, spans)).toEqual(
      new Set([spanID0, spanID2])
    );
    expect(
      filterSpans({ ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'status', value: 'unset' }] }, spans)
    ).toEqual(new Set([spanID0]));
    expect(
      filterSpans(
        { ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'status', operator: '!=', value: 'unset' }] },
        spans
      )
    ).toEqual(new Set([spanID2]));

    expect(filterSpans({ ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'status.message' }] }, spans)).toEqual(
      new Set([spanID0, spanID2])
    );
    expect(
      filterSpans(
        { ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'status.message', value: 'statusMessage0' }] },
        spans
      )
    ).toEqual(new Set([spanID0]));
    expect(
      filterSpans(
        {
          ...defaultFilters,
          tags: [{ ...defaultTagFilter, key: 'status.message', operator: '!=', value: 'statusMessage0' }],
        },
        spans
      )
    ).toEqual(new Set([spanID2]));
    expect(filterSpans({ ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'library.name' }] }, spans)).toEqual(
      new Set([spanID0, spanID2])
    );
    expect(
      filterSpans(
        { ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'library.name', value: 'libraryName' }] },
        spans
      )
    ).toEqual(new Set([spanID0, spanID2]));
    expect(
      filterSpans(
        {
          ...defaultFilters,
          tags: [{ ...defaultTagFilter, key: 'library.name', operator: '!=', value: 'libraryName' }],
        },
        spans
      )
    ).toEqual(new Set([]));
    expect(filterSpans({ ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'library.version' }] }, spans)).toEqual(
      new Set([spanID0, spanID2])
    );
    expect(
      filterSpans(
        { ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'library.version', value: 'libraryVersion0' }] },
        spans
      )
    ).toEqual(new Set([spanID0]));
    expect(
      filterSpans(
        {
          ...defaultFilters,
          tags: [{ ...defaultTagFilter, key: 'library.version', operator: '!=', value: 'libraryVersion0' }],
        },
        spans
      )
    ).toEqual(new Set([spanID2]));
    expect(filterSpans({ ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'trace.state' }] }, spans)).toEqual(
      new Set([spanID0, spanID2])
    );
    expect(
      filterSpans(
        { ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'trace.state', value: 'traceState0' }] },
        spans
      )
    ).toEqual(new Set([spanID0]));
    expect(
      filterSpans(
        {
          ...defaultFilters,
          tags: [{ ...defaultTagFilter, key: 'trace.state', operator: '!=', value: 'traceState0' }],
        },
        spans
      )
    ).toEqual(new Set([spanID2]));
    expect(filterSpans({ ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'id' }] }, spans)).toEqual(
      new Set([spanID0, spanID2])
    );
    expect(
      filterSpans({ ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'id', value: 'span-id-0' }] }, spans)
    ).toEqual(new Set([spanID0]));
    expect(
      filterSpans(
        { ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'id', operator: '!=', value: 'span-id-0' }] },
        spans
      )
    ).toEqual(new Set([spanID2]));
  });

  it('should return spans whose process.tags kv.key match a filter', () => {
    expect(filterSpans({ ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'processTagKey1' }] }, spans)).toEqual(
      new Set([spanID0, spanID2])
    );
    expect(filterSpans({ ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'processTagKey0' }] }, spans)).toEqual(
      new Set([spanID0])
    );
    expect(filterSpans({ ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'processTagKey2' }] }, spans)).toEqual(
      new Set([spanID2])
    );
    expect(
      filterSpans({ ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'processTagKey2', operator: '!=' }] }, spans)
    ).toEqual(new Set([spanID0]));
  });

  it('should return spans whose logs have a field whose kv.key match a filter', () => {
    expect(filterSpans({ ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'logFieldKey1' }] }, spans)).toEqual(
      new Set([spanID0, spanID2])
    );
    expect(filterSpans({ ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'logFieldKey0' }] }, spans)).toEqual(
      new Set([spanID0])
    );
    expect(filterSpans({ ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'logFieldKey2' }] }, spans)).toEqual(
      new Set([spanID2])
    );
    expect(
      filterSpans({ ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'logFieldKey2', operator: '!=' }] }, spans)
    ).toEqual(new Set([spanID0]));
  });

  it('it should return logs have a name which matches the filter', () => {
    expect(filterSpans({ ...defaultFilters, query: 'logName0' }, spans)).toEqual(new Set([spanID0]));
  });

  it('should return no spans when logs is null', () => {
    const nullSpan = { ...span0, logs: null };
    expect(
      filterSpans({ ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'logFieldKey1' }] }, [
        nullSpan,
      ] as unknown as TraceSpan[])
    ).toEqual(new Set([]));
  });

  it("should return spans whose tags' kv.key and kv.value match a filter", () => {
    expect(
      filterSpans({ ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'tagKey1', value: 'tagValue1' }] }, spans)
    ).toEqual(new Set([spanID0]));
    expect(
      filterSpans(
        { ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'tagKey1', value: 'tagValue1', operator: '=' }] },
        spans
      )
    ).toEqual(new Set([spanID0]));
    expect(
      filterSpans(
        { ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'tagKey1', value: 'tagValue1', operator: '!=' }] },
        spans
      )
    ).toEqual(new Set([spanID2]));
    expect(
      filterSpans(
        { ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'tagKey1', operator: '=~', value: 'tagValue' }] },
        spans
      )
    ).toEqual(new Set([spanID0, spanID2]));
    expect(
      filterSpans(
        { ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'tagKey1', operator: '!~', value: 'tagValue1' }] },
        spans
      )
    ).toEqual(new Set([spanID2]));
    expect(
      filterSpans(
        { ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'tagKey1', operator: '!~', value: 'tag' }] },
        spans
      )
    ).toEqual(new Set([]));
  });

  it("should not return spans whose tags' kv.key match a filter but kv.value/operator does not match", () => {
    expect(
      filterSpans({ ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'tagKey1', operator: '!=' }] }, spans)
    ).toEqual(new Set());
    expect(
      filterSpans({ ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'tagKey2', operator: '!=' }] }, spans)
    ).toEqual(new Set([spanID0]));
    expect(
      filterSpans(
        { ...defaultFilters, tags: [{ ...defaultTagFilter, key: 'tagKey1', value: 'tagValue1', operator: '!=' }] },
        spans
      )
    ).toEqual(new Set([spanID2]));
  });

  it('should return spans with multiple tag filters', () => {
    // tags in same span
    expect(
      filterSpans(
        {
          ...defaultFilters,
          tags: [
            { ...defaultTagFilter, key: 'tagKey1' },
            { ...defaultTagFilter, key: 'tagKey0' },
          ],
        },
        spans
      )
    ).toEqual(new Set([spanID0]));
    expect(
      filterSpans(
        {
          ...defaultFilters,
          tags: [
            { ...defaultTagFilter, key: 'tagKey1', value: 'tagValue1' },
            { ...defaultTagFilter, key: 'tagKey0' },
          ],
        },
        spans
      )
    ).toEqual(new Set([spanID0]));
    expect(
      filterSpans(
        {
          ...defaultFilters,
          tags: [
            { ...defaultTagFilter, key: 'tagKey1', value: 'tagValue1' },
            { ...defaultTagFilter, key: 'tagKey0', value: 'tagValue0' },
          ],
        },
        spans
      )
    ).toEqual(new Set([spanID0]));

    // tags in different spans
    expect(
      filterSpans(
        {
          ...defaultFilters,
          tags: [
            { ...defaultTagFilter, key: 'tagKey0' },
            { ...defaultTagFilter, key: 'tagKey2' },
          ],
        },
        spans
      )
    ).toEqual(new Set());
    expect(
      filterSpans(
        {
          ...defaultFilters,
          tags: [
            { ...defaultTagFilter, key: 'tagKey0', value: '' },
            { ...defaultTagFilter, key: 'tagKey2' },
          ],
        },
        spans
      )
    ).toEqual(new Set());

    // values in different spans
    expect(
      filterSpans(
        {
          ...defaultFilters,
          tags: [
            { ...defaultTagFilter, key: 'tagKey0', value: 'tagValue0' },
            { ...defaultTagFilter, key: 'tagKey2' },
          ],
        },
        spans
      )
    ).toEqual(new Set());
    expect(
      filterSpans(
        {
          ...defaultFilters,
          tags: [
            { ...defaultTagFilter, key: 'tagKey0', value: 'tagValue0' },
            { ...defaultTagFilter, key: 'tagKey2', value: 'tagValue2' },
          ],
        },
        spans
      )
    ).toEqual(new Set());
    expect(
      filterSpans(
        {
          ...defaultFilters,
          tags: [
            { ...defaultTagFilter, key: 'tagKey1', value: 'tagValue1' },
            { ...defaultTagFilter, key: 'tagKey1', value: 'tagValue2' },
          ],
        },
        spans
      )
    ).toEqual(new Set());
    expect(
      filterSpans(
        {
          ...defaultFilters,
          tags: [
            { ...defaultTagFilter, key: 'tagKey1', value: 'tagValue1' },
            { ...defaultTagFilter, key: 'tagKey2', value: 'tagValue2' },
          ],
        },
        spans
      )
    ).toEqual(new Set());

    // query
    expect(filterSpans({ ...defaultFilters, query: 'serviceName0' }, spans)).toEqual(new Set([spanID0]));
    expect(filterSpans({ ...defaultFilters, query: 'tagKey1' }, spans)).toEqual(new Set([spanID0, spanID2]));
    expect(filterSpans({ ...defaultFilters, query: 'does_not_exist' }, spans)).toEqual(new Set([]));
  });

  // Multiple
  it('should return spans with multiple filters', () => {
    // service name + span name
    expect(filterSpans({ ...defaultFilters, serviceName: 'serviceName0', spanName: 'operationName0' }, spans)).toEqual(
      new Set([spanID0])
    );
    expect(filterSpans({ ...defaultFilters, serviceName: 'serviceName0', spanName: 'operationName2' }, spans)).toEqual(
      new Set([])
    );
    expect(
      filterSpans(
        { ...defaultFilters, serviceName: 'serviceName0', spanName: 'operationName2', spanNameOperator: '!=' },
        spans
      )
    ).toEqual(new Set([spanID0]));

    // service name + span name + duration
    expect(
      filterSpans({ ...defaultFilters, serviceName: 'serviceName0', spanName: 'operationName0', from: '2ms' }, spans)
    ).toEqual(new Set([spanID0]));
    expect(
      filterSpans({ ...defaultFilters, serviceName: 'serviceName0', spanName: 'operationName0', to: '2ms' }, spans)
    ).toEqual(new Set([]));
    expect(
      filterSpans({ ...defaultFilters, serviceName: 'serviceName2', spanName: 'operationName2', to: '6ms' }, spans)
    ).toEqual(new Set([spanID2]));

    // service name + tag key
    expect(
      filterSpans(
        { ...defaultFilters, serviceName: 'serviceName0', tags: [{ ...defaultTagFilter, key: 'tagKey0' }] },
        spans
      )
    ).toEqual(new Set([spanID0]));
    expect(
      filterSpans(
        { ...defaultFilters, serviceName: 'serviceName0', tags: [{ ...defaultTagFilter, key: 'tagKey1' }] },
        spans
      )
    ).toEqual(new Set([spanID0]));
    expect(
      filterSpans(
        { ...defaultFilters, serviceName: 'serviceName2', tags: [{ ...defaultTagFilter, key: 'tagKey1' }] },
        spans
      )
    ).toEqual(new Set([spanID2]));
    expect(
      filterSpans(
        { ...defaultFilters, serviceName: 'serviceName2', tags: [{ ...defaultTagFilter, key: 'tagKey2' }] },
        spans
      )
    ).toEqual(new Set([spanID2]));
    expect(
      filterSpans(
        {
          ...defaultFilters,
          serviceName: 'serviceName0',
          tags: [{ ...defaultTagFilter, key: 'tagKey1', operator: '!=' }],
        },
        spans
      )
    ).toEqual(new Set());

    // duration + tag
    expect(
      filterSpans({ ...defaultFilters, from: '2ms', tags: [{ ...defaultTagFilter, key: 'tagKey0' }] }, spans)
    ).toEqual(new Set([spanID0]));
    expect(
      filterSpans(
        { ...defaultFilters, to: '5ms', toOperator: '<=', tags: [{ ...defaultTagFilter, key: 'tagKey2' }] },
        spans
      )
    ).toEqual(new Set([spanID2]));

    // query + other
    expect(filterSpans({ ...defaultFilters, serviceName: 'serviceName0', query: 'tag' }, spans)).toEqual(
      new Set([spanID0])
    );
    expect(filterSpans({ ...defaultFilters, serviceName: 'serviceName0', query: 'tagKey2' }, spans)).toEqual(
      new Set([])
    );
    expect(
      filterSpans(
        { ...defaultFilters, serviceName: 'serviceName2', spanName: 'operationName2', query: 'tagKey1' },
        spans
      )
    ).toEqual(new Set([spanID2]));
    expect(
      filterSpans(
        { ...defaultFilters, serviceName: 'serviceName2', spanName: 'operationName2', to: '6ms', query: 'kind2' },
        spans
      )
    ).toEqual(new Set([spanID2]));
    expect(
      filterSpans(
        {
          ...defaultFilters,
          serviceName: 'serviceName0',
          spanName: 'operationName0',
          from: '2ms',
          query: 'logFieldKey1',
        },
        spans
      )
    ).toEqual(new Set([spanID0]));

    // all
    expect(
      filterSpans(
        {
          ...defaultFilters,
          serviceName: 'serviceName0',
          spanName: 'operationName2',
          spanNameOperator: '!=',
          from: '3.05ms',
          fromOperator: '>=',
          to: '3.5ms',
          tags: [{ ...defaultTagFilter, key: 'tagKey2', operator: '!=' }],
        },
        spans
      )
    ).toEqual(new Set([spanID0]));
  });
});
