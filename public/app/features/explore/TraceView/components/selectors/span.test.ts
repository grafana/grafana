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

import { TraceResponse } from 'app/features/explore/TraceView/components/types';

import traceGenerator from '../demo/trace-generators';

import * as spanSelectors from './span';

const generatedTrace: TraceResponse = traceGenerator.trace({ numberOfSpans: 45 });

it('getSpanId() should return the name of the span', () => {
  const span = generatedTrace.spans[0];

  expect(spanSelectors.getSpanId(span)).toBe(span.spanID);
});

it('getSpanReferences() should return the span reference array', () => {
  expect(spanSelectors.getSpanReferences(generatedTrace.spans[0])).toEqual(generatedTrace.spans[0].references);
});

it('getSpanReferences() should return an empty array when references is undefined', () => {
  const span = generatedTrace.spans[0];
  span.references = undefined;
  expect(spanSelectors.getSpanReferences(span)).toEqual([]);
});

it('getSpanReferenceByType() should return the span reference requested', () => {
  expect(
    spanSelectors.getSpanReferenceByType({
      span: generatedTrace.spans[1],
      type: 'CHILD_OF',
    })?.refType
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
    generatedTrace.spans[1].references!.find(({ refType }: { refType: string }) => refType === 'CHILD_OF')!.spanID
  );
});

it('getSpanParentId() should return null if no CHILD_OF reference exists', () => {
  expect(spanSelectors.getSpanParentId(generatedTrace.spans[0])).toBe(null);
});
