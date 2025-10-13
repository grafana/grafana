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
import { TraceSpan } from '../types';

import {
  findServerChildSpan,
  createViewedBoundsFunc,
  isClientSpan,
  isErrorSpan,
  isServerSpan,
  spanContainsErredSpan,
  spanHasTag,
} from './utils';

describe('TraceTimelineViewer/utils', () => {
  describe('getViewedBounds()', () => {
    it('works for the full range', () => {
      const args = { min: 1, max: 2, viewStart: 0, viewEnd: 1 };
      const { start, end } = createViewedBoundsFunc(args)(1, 2);
      expect(start).toBe(0);
      expect(end).toBe(1);
    });

    it('works for a sub-range with a full view', () => {
      const args = { min: 1, max: 2, viewStart: 0, viewEnd: 1 };
      const { start, end } = createViewedBoundsFunc(args)(1.25, 1.75);
      expect(start).toBe(0.25);
      expect(end).toBe(0.75);
    });

    it('works for a sub-range that fills the view', () => {
      const args = { min: 1, max: 2, viewStart: 0.25, viewEnd: 0.75 };
      const { start, end } = createViewedBoundsFunc(args)(1.25, 1.75);
      expect(start).toBe(0);
      expect(end).toBe(1);
    });

    it('works for a sub-range that within a sub-view', () => {
      const args = { min: 100, max: 200, viewStart: 0.1, viewEnd: 0.9 };
      const { start, end } = createViewedBoundsFunc(args)(130, 170);
      expect(start).toBe(0.25);
      expect(end).toBe(0.75);
    });
  });

  describe('spanHasTag() and variants', () => {
    it('returns true if client span', () => {
      const span = traceGenerator.span;
      span.kind = 'client';
      expect(isServerSpan(span)).toBe(false);
      expect(isClientSpan(span)).toBe(true);
      span.kind = 'server';
      expect(isServerSpan(span)).toBe(true);
      expect(isClientSpan(span)).toBe(false);
      span.statusCode = 0;
      expect(isErrorSpan(span)).toBe(false);
      span.statusCode = 2;
      expect(isErrorSpan(span)).toBe(true);
    });

    it('returns true if the key/value pair is found', () => {
      const span = traceGenerator.span;
      span.tags = [{ key: 'span.kind', value: 'server' }];
      expect(spanHasTag('span.kind', 'client', span)).toBe(false);
      expect(spanHasTag('span.kind', 'server', span)).toBe(true);
    });

    const spanTypeTestCases = [
      { fn: isClientSpan, name: 'isClientSpan', key: 'span.kind', value: 'client' },
      { fn: isServerSpan, name: 'isServerSpan', key: 'span.kind', value: 'server' },
      { fn: isErrorSpan, name: 'isErrorSpan', key: 'error', value: true },
      { fn: isErrorSpan, name: 'isErrorSpan', key: 'error', value: 'true' },
    ];

    spanTypeTestCases.forEach((testCase) => {
      const msg = `${testCase.name}() is true only when a ${testCase.key}=${testCase.value} tag is present`;
      it(msg, () => {
        const span = { tags: traceGenerator.tags() } as TraceSpan;
        expect(testCase.fn(span)).toBe(false);
        span.tags!.push(testCase);
        expect(testCase.fn(span)).toBe(true);
      });
    });
  });

  describe('spanContainsErredSpan()', () => {
    // Using a string to generate the test spans. Each line results in a span. The
    // left number indicates whether or not the generated span has a descendant
    // with an error tag (the expectation). The length of the line indicates the
    // depth of the span (i.e. further right is higher depth). The right number
    // indicates whether or not the span has an error tag.
    const config = `
      1   0
      1     0
      0       1
      0     0
      1     0
      1       1
      0         1
      0           0
      1         0
      0           1
      0   0
    `
      .trim()
      .split('\n')
      .map((s) => s.trim());
    // Get the expectation, str -> number -> bool
    const expectations = config.map((s) => Boolean(Number(s[0])));

    it('returns true only when a descendant has an error value', () => {
      const spans = config.map((line) => ({
        depth: line.length,
        statusCode: +line.slice(-1) ? 2 : 0,
      })) as TraceSpan[];

      expectations.forEach((target, i) => {
        // include the index in the expect condition to know which span failed
        // (if there is a failure, that is)
        const result = [i, spanContainsErredSpan(spans, i)];
        expect(result).toEqual([i, target]);
      });
    });

    it('returns true only when a descendant has an error tag', () => {
      const errorTag = { key: 'error', type: 'bool', value: true };
      const getTags = (withError: number) =>
        withError ? traceGenerator.tags().concat(errorTag) : traceGenerator.tags();

      const spans = config.map((line) => ({
        depth: line.length,
        tags: getTags(+line.slice(-1)),
      })) as TraceSpan[];

      expectations.forEach((target, i) => {
        // include the index in the expect condition to know which span failed
        // (if there is a failure, that is)
        const result = [i, spanContainsErredSpan(spans, i)];
        expect(result).toEqual([i, target]);
      });
    });
  });

  describe('findServerChildSpan() for OTEL', () => {
    let spans: TraceSpan[];

    beforeEach(() => {
      spans = [
        { depth: 0, kind: 'client' },
        { depth: 1 },
        { depth: 1, kind: 'server' },
        { depth: 1, kind: 'third-kind' },
        { depth: 1, kind: 'server' },
      ] as TraceSpan[];
    });

    it('returns falsy if the frist span is not a client', () => {
      expect(findServerChildSpan(spans.slice(1))).toBeFalsy();
    });

    it('returns the first server span', () => {
      const span = findServerChildSpan(spans);
      expect(span).toBe(spans[2]);
    });

    it('bails when a non-child-depth span is encountered', () => {
      spans[1].depth++;
      expect(findServerChildSpan(spans)).toBeFalsy();
      spans[1].depth = spans[0].depth;
      expect(findServerChildSpan(spans)).toBeFalsy();
    });
  });

  describe('findServerChildSpan()', () => {
    let spans: TraceSpan[];

    beforeEach(() => {
      spans = [
        { depth: 0, tags: [{ key: 'span.kind', value: 'client' }] },
        { depth: 1, tags: [] },
        { depth: 1, tags: [{ key: 'span.kind', value: 'server' }] },
        { depth: 1, tags: [{ key: 'span.kind', value: 'third-kind' }] },
        { depth: 1, tags: [{ key: 'span.kind', value: 'server' }] },
      ] as TraceSpan[];
    });

    it('returns falsy if the frist span is not a client', () => {
      expect(findServerChildSpan(spans.slice(1))).toBeFalsy();
    });

    it('returns the first server span', () => {
      const span = findServerChildSpan(spans);
      expect(span).toBe(spans[2]);
    });

    it('bails when a non-child-depth span is encountered', () => {
      spans[1].depth++;
      expect(findServerChildSpan(spans)).toBeFalsy();
      spans[1].depth = spans[0].depth;
      expect(findServerChildSpan(spans)).toBeFalsy();
    });
  });
});
