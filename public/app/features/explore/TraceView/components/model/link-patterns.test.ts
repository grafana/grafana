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

import { Trace } from '../types/trace';

import {
  processTemplate,
  createTestFunction,
  processLinkPattern,
  ProcessedLinkPattern,
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
          template: (data: { [key: string]: unknown }) => `a${data.b}c`,
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
