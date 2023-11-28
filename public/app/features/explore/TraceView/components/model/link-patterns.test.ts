// Copyright (c) 2017 The Jaeger Authors.
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

import { Trace, TraceLink, TraceSpan } from '../types';

import {
  processTemplate,
  createTestFunction,
  getParameterInArray,
  getParameterInAncestor,
  processLinkPattern,
  ProcessedLinkPattern,
  computeLinks,
  createGetLinks,
  computeTraceLink,
} from './link-patterns';

describe('processTemplate()', () => {
  it('correctly replaces variables', () => {
    const processedTemplate = processTemplate(
      'this is a test with #{oneVariable}#{anotherVariable} and the same #{oneVariable}',
      (a) => a
    );
    expect(processedTemplate.parameters).toEqual(['oneVariable', 'anotherVariable']);
    expect(processedTemplate.template({ oneVariable: 'MYFIRSTVAR', anotherVariable: 'SECOND' })).toBe(
      'this is a test with MYFIRSTVARSECOND and the same MYFIRSTVAR'
    );
  });

  it('correctly uses the encoding function', () => {
    const processedTemplate = processTemplate(
      'this is a test with #{oneVariable}#{anotherVariable} and the same #{oneVariable}',
      (e) => `/${e}\\`
    );
    expect(processedTemplate.parameters).toEqual(['oneVariable', 'anotherVariable']);
    expect(processedTemplate.template({ oneVariable: 'MYFIRSTVAR', anotherVariable: 'SECOND' })).toBe(
      'this is a test with /MYFIRSTVAR\\/SECOND\\ and the same /MYFIRSTVAR\\'
    );
  });

  /*
  // kept on ice until #123 is implemented:

  it('correctly returns the same object when passing an already processed template', () => {
    const alreadyProcessed = {
      parameters: ['b'],
      template: data => `a${data.b}c`,
    };
    const processedTemplate = processTemplate(alreadyProcessed, a => a);
    expect(processedTemplate).toBe(alreadyProcessed);
  });

  */

  it('reports an error when passing an object that does not look like an already processed template', () => {
    expect(() =>
      processTemplate(
        {
          template: (data: { [key: string]: any }) => `a${data.b}c`,
        },
        (a) => a
      )
    ).toThrow();
    expect(() =>
      processTemplate(
        {
          parameters: ['b'],
        },
        (a) => a
      )
    ).toThrow();
    expect(() => processTemplate({}, (a) => a)).toThrow();
  });
});

describe('createTestFunction()', () => {
  it('accepts a string', () => {
    const testFn = createTestFunction('myValue');
    expect(testFn('myValue')).toBe(true);
    expect(testFn('myFirstValue')).toBe(false);
    expect(testFn('mySecondValue')).toBe(false);
    expect(testFn('otherValue')).toBe(false);
  });

  it('accepts an array', () => {
    const testFn = createTestFunction(['myFirstValue', 'mySecondValue']);
    expect(testFn('myValue')).toBe(false);
    expect(testFn('myFirstValue')).toBe(true);
    expect(testFn('mySecondValue')).toBe(true);
    expect(testFn('otherValue')).toBe(false);
  });

  /*
  // kept on ice until #123 is implemented:

  it('accepts a regular expression', () => {
    const testFn = createTestFunction(/^my.*Value$/);
    expect(testFn('myValue')).toBe(true);
    expect(testFn('myFirstValue')).toBe(true);
    expect(testFn('mySecondValue')).toBe(true);
    expect(testFn('otherValue')).toBe(false);
  });

  it('accepts a function', () => {
    const mockCallback = jest.fn();
    mockCallback
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
      .mockReturnValue(false);
    const testFn = createTestFunction(mockCallback);
    expect(testFn('myValue')).toBe(true);
    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(mockCallback).toHaveBeenCalledWith('myValue');
    expect(testFn('myFirstValue')).toBe(false);
    expect(mockCallback).toHaveBeenCalledTimes(2);
    expect(mockCallback).toHaveBeenCalledWith('myFirstValue');
    expect(testFn('mySecondValue')).toBe(true);
    expect(mockCallback).toHaveBeenCalledTimes(3);
    expect(mockCallback).toHaveBeenCalledWith('mySecondValue');
    expect(testFn('otherValue')).toBe(false);
    expect(mockCallback).toHaveBeenCalledTimes(4);
    expect(mockCallback).toHaveBeenCalledWith('otherValue');
  });

  */

  it('accepts undefined', () => {
    const testFn = createTestFunction();
    expect(testFn('myValue')).toBe(true);
    expect(testFn('myFirstValue')).toBe(true);
    expect(testFn('mySecondValue')).toBe(true);
    expect(testFn('otherValue')).toBe(true);
  });

  it('rejects unknown values', () => {
    expect(() => createTestFunction({})).toThrow();
    expect(() => createTestFunction(true)).toThrow();
    expect(() => createTestFunction(false)).toThrow();
    expect(() => createTestFunction(0)).toThrow();
    expect(() => createTestFunction(5)).toThrow();
  });
});

describe('getParameterInArray()', () => {
  const data = [
    { key: 'mykey', value: 'ok' },
    { key: 'otherkey', value: 'v' },
  ];

  it('returns an entry that is present', () => {
    expect(getParameterInArray('mykey', data)).toBe(data[0]);
    expect(getParameterInArray('otherkey', data)).toBe(data[1]);
  });

  it('returns undefined when the entry cannot be found', () => {
    expect(getParameterInArray('myotherkey', data)).toBeUndefined();
  });

  it('returns undefined when there is no array', () => {
    expect(getParameterInArray('otherkey')).toBeUndefined();
    expect(getParameterInArray('otherkey', null)).toBeUndefined();
  });
});

describe('getParameterInAncestor()', () => {
  const spans = [
    {
      depth: 0,
      process: {
        tags: [
          { key: 'a', value: 'a7' },
          { key: 'b', value: 'b7' },
          { key: 'c', value: 'c7' },
          { key: 'd', value: 'd7' },
          { key: 'e', value: 'e7' },
          { key: 'f', value: 'f7' },
          { key: 'g', value: 'g7' },
          { key: 'h', value: 'h7' },
        ],
      },
      tags: [
        { key: 'a', value: 'a6' },
        { key: 'b', value: 'b6' },
        { key: 'c', value: 'c6' },
        { key: 'd', value: 'd6' },
        { key: 'e', value: 'e6' },
        { key: 'f', value: 'f6' },
        { key: 'g', value: 'g6' },
      ],
    },
    {
      depth: 1,
      process: {
        tags: [
          { key: 'a', value: 'a5' },
          { key: 'b', value: 'b5' },
          { key: 'c', value: 'c5' },
          { key: 'd', value: 'd5' },
          { key: 'e', value: 'e5' },
          { key: 'f', value: 'f5' },
        ],
      },
      tags: [
        { key: 'a', value: 'a4' },
        { key: 'b', value: 'b4' },
        { key: 'c', value: 'c4' },
        { key: 'd', value: 'd4' },
        { key: 'e', value: 'e4' },
      ],
    },
    {
      depth: 1,
      process: {
        tags: [
          { key: 'a', value: 'a3' },
          { key: 'b', value: 'b3' },
          { key: 'c', value: 'c3' },
          { key: 'd', value: 'd3' },
        ],
      },
      tags: [
        { key: 'a', value: 'a2' },
        { key: 'b', value: 'b2' },
        { key: 'c', value: 'c2' },
      ],
    },
    {
      depth: 2,
      process: {
        tags: [
          { key: 'a', value: 'a1' },
          { key: 'b', value: 'b1' },
        ],
      },
      tags: [{ key: 'a', value: 'a0' }],
    },
  ] as TraceSpan[];

  spans[1].references = [
    {
      spanID: 's1',
      traceID: 't2',
      refType: 'CHILD_OF',
      span: spans[0],
    },
  ];
  spans[2].references = [
    {
      spanID: 's1',
      traceID: 't2',
      refType: 'CHILD_OF',
      span: spans[0],
    },
  ];
  spans[3].references = [
    {
      spanID: 's1',
      traceID: 't2',
      refType: 'CHILD_OF',
      span: spans[2],
    },
  ];

  it('uses current span tags', () => {
    expect(getParameterInAncestor('a', spans[3])).toEqual({ key: 'a', value: 'a0' });
    expect(getParameterInAncestor('a', spans[2])).toEqual({ key: 'a', value: 'a2' });
    expect(getParameterInAncestor('a', spans[1])).toEqual({ key: 'a', value: 'a4' });
    expect(getParameterInAncestor('a', spans[0])).toEqual({ key: 'a', value: 'a6' });
  });

  it('uses current span process tags', () => {
    expect(getParameterInAncestor('b', spans[3])).toEqual({ key: 'b', value: 'b1' });
    expect(getParameterInAncestor('d', spans[2])).toEqual({ key: 'd', value: 'd3' });
    expect(getParameterInAncestor('f', spans[1])).toEqual({ key: 'f', value: 'f5' });
    expect(getParameterInAncestor('h', spans[0])).toEqual({ key: 'h', value: 'h7' });
  });

  it('uses parent span tags', () => {
    expect(getParameterInAncestor('c', spans[3])).toEqual({ key: 'c', value: 'c2' });
    expect(getParameterInAncestor('e', spans[2])).toEqual({ key: 'e', value: 'e6' });
    expect(getParameterInAncestor('f', spans[2])).toEqual({ key: 'f', value: 'f6' });
    expect(getParameterInAncestor('g', spans[2])).toEqual({ key: 'g', value: 'g6' });
    expect(getParameterInAncestor('g', spans[1])).toEqual({ key: 'g', value: 'g6' });
  });

  it('uses parent span process tags', () => {
    expect(getParameterInAncestor('d', spans[3])).toEqual({ key: 'd', value: 'd3' });
    expect(getParameterInAncestor('h', spans[2])).toEqual({ key: 'h', value: 'h7' });
    expect(getParameterInAncestor('h', spans[1])).toEqual({ key: 'h', value: 'h7' });
  });

  it('uses grand-parent span tags', () => {
    expect(getParameterInAncestor('e', spans[3])).toEqual({ key: 'e', value: 'e6' });
    expect(getParameterInAncestor('f', spans[3])).toEqual({ key: 'f', value: 'f6' });
    expect(getParameterInAncestor('g', spans[3])).toEqual({ key: 'g', value: 'g6' });
  });

  it('uses grand-parent process tags', () => {
    expect(getParameterInAncestor('h', spans[3])).toEqual({ key: 'h', value: 'h7' });
  });

  it('returns undefined when the entry cannot be found', () => {
    expect(getParameterInAncestor('i', spans[3])).toBeUndefined();
  });

  it('does not break if some tags are not defined', () => {
    const spansWithUndefinedTags = [
      {
        depth: 0,
        process: {},
      },
    ] as TraceSpan[];
    expect(getParameterInAncestor('a', spansWithUndefinedTags[0])).toBeUndefined();
  });
});

describe('computeTraceLink()', () => {
  const linkPatterns = [
    {
      type: 'traces',
      url: 'http://example.com/?myKey=#{traceID}',
      text: 'first link (#{traceID})',
    },
    {
      type: 'traces',
      url: 'http://example.com/?myKey=#{traceID}&myKey=#{myKey}',
      text: 'second link (#{myKey})',
    },
  ].map(processLinkPattern) as ProcessedLinkPattern[];

  const trace = {
    processes: [],
    traceID: 'trc1',
    spans: [],
    startTime: 1000,
    endTime: 2000,
    duration: 1000,
    services: [],
  } as unknown as Trace;

  it('correctly computes links', () => {
    expect(computeTraceLink(linkPatterns, trace)).toEqual([
      {
        url: 'http://example.com/?myKey=trc1',
        text: 'first link (trc1)',
      },
    ]);
  });
});

describe('computeLinks()', () => {
  const linkPatterns = [
    {
      type: 'tags',
      key: 'myKey',
      url: 'http://example.com/?myKey=#{myKey}',
      text: 'first link (#{myKey})',
    },
    {
      key: 'myOtherKey',
      url: 'http://example.com/?myKey=#{myOtherKey}&myKey=#{myKey}',
      text: 'second link (#{myOtherKey})',
    },
  ].map(processLinkPattern) as ProcessedLinkPattern[];

  const spans = [
    { depth: 0, process: {}, tags: [{ key: 'myKey', value: 'valueOfMyKey' }] },
    { depth: 1, process: {}, logs: [{ fields: [{ key: 'myOtherKey', value: 'valueOfMy+Other+Key' }] }] },
  ] as unknown as TraceSpan[];
  spans[1].references = [
    {
      spanID: 's1',
      traceID: 't2',
      refType: 'CHILD_OF',
      span: spans[0],
    },
  ];

  it('correctly computes links', () => {
    expect(computeLinks(linkPatterns, spans[0], spans[0].tags, 0)).toEqual([
      {
        url: 'http://example.com/?myKey=valueOfMyKey',
        text: 'first link (valueOfMyKey)',
      },
    ]);
    expect(computeLinks(linkPatterns, spans[1], spans[1].logs[0].fields, 0)).toEqual([
      {
        url: 'http://example.com/?myKey=valueOfMy%2BOther%2BKey&myKey=valueOfMyKey',
        text: 'second link (valueOfMy+Other+Key)',
      },
    ]);
  });
});

describe('getLinks()', () => {
  const linkPatterns = [
    {
      key: 'mySpecialKey',
      url: 'http://example.com/?mySpecialKey=#{mySpecialKey}',
      text: 'special key link (#{mySpecialKey})',
    },
  ].map(processLinkPattern) as ProcessedLinkPattern[];
  const template = jest.spyOn(linkPatterns[0]!.url, 'template');

  const span = { depth: 0, process: {}, tags: [{ key: 'mySpecialKey', value: 'valueOfMyKey' }] } as TraceSpan;

  let cache: WeakMap<object, any>;

  beforeEach(() => {
    cache = new WeakMap();
    template.mockClear();
  });

  it('does not access the cache if there is no link pattern', () => {
    cache.get = jest.fn();
    const getLinks = createGetLinks([], cache);
    expect(getLinks(span, span.tags, 0)).toEqual([]);
    expect(cache.get).not.toHaveBeenCalled();
  });

  it('returns the result from the cache', () => {
    const result: TraceLink[] = [];
    cache.set(span.tags[0], result);
    const getLinks = createGetLinks(linkPatterns, cache);
    expect(getLinks(span, span.tags, 0)).toBe(result);
    expect(template).not.toHaveBeenCalled();
  });

  it('adds the result to the cache', () => {
    const getLinks = createGetLinks(linkPatterns, cache);
    const result = getLinks(span, span.tags, 0);
    expect(template).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      {
        url: 'http://example.com/?mySpecialKey=valueOfMyKey',
        text: 'special key link (valueOfMyKey)',
      },
    ]);
    expect(cache.get(span.tags[0])).toBe(result);
  });
});
