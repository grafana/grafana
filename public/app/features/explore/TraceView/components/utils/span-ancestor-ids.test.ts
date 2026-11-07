// Copyright (c) 2018 Uber Technologies, Inc.
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

import { type TraceSpan } from '../types/trace';

import spanAncestorIdsSpy from './span-ancestor-ids';

describe('spanAncestorIdsSpy', () => {
  const ownSpanID = 'ownSpanID';
  const firstParentSpanID = 'firstParentSpanID';
  const firstParentFirstGrandparentSpanID = 'firstParentFirstGrandparentSpanID';
  const firstParentSecondGrandparentSpanID = 'firstParentSecondGrandparentSpanID';
  const secondParentSpanID = 'secondParentSpanID';
  const rootSpanID = 'rootSpanID';
  const span = {
    references: [
      {
        span: {
          spanID: firstParentSpanID,
          references: [
            {
              span: {
                spanID: firstParentFirstGrandparentSpanID,
                references: [
                  {
                    span: {
                      spanID: rootSpanID,
                    },
                  },
                ],
              },
              refType: 'not an ancestor ref type',
            },
            {
              span: {
                spanID: firstParentSecondGrandparentSpanID,
                references: [
                  {
                    span: {
                      spanID: rootSpanID,
                    },
                    refType: 'FOLLOWS_FROM',
                  },
                ],
              },
              refType: 'CHILD_OF',
            },
          ],
        },
        refType: 'CHILD_OF',
      },
      {
        span: {
          spanID: secondParentSpanID,
        },
        refType: 'CHILD_OF',
      },
    ],
    spanID: ownSpanID,
  };
  const expectedAncestorIds = [firstParentSpanID, firstParentSecondGrandparentSpanID, rootSpanID];

  it('returns an empty array if given falsy span', () => {
    expect(spanAncestorIdsSpy(null)).toEqual([]);
  });

  it('returns an empty array if span has no references', () => {
    const spanWithoutReferences = {
      spanID: 'parentlessSpanID',
      references: [],
    };

    expect(spanAncestorIdsSpy(spanWithoutReferences as unknown as TraceSpan)).toEqual([]);
  });

  it('returns all unique spanIDs from first valid CHILD_OF or FOLLOWS_FROM reference up to the root span', () => {
    expect(spanAncestorIdsSpy(span as TraceSpan)).toEqual(expectedAncestorIds);
  });

  it('ignores references without a span', () => {
    const spanWithSomeEmptyReferences = {
      ...span,
      references: [{ refType: 'CHILD_OF' }, { refType: 'FOLLOWS_FROM', span: {} }, ...span.references],
    };
    expect(spanAncestorIdsSpy(spanWithSomeEmptyReferences as TraceSpan)).toEqual(expectedAncestorIds);
  });

  it('returns the ancestors stored on the span instead of following references', () => {
    const spanWithAncestors = { ...span, ancestorSpanIds: ['storedParent', 'storedRoot'] };

    expect(spanAncestorIdsSpy(spanWithAncestors as unknown as TraceSpan)).toEqual(['storedParent', 'storedRoot']);
  });

  it('returns a copy of the stored ancestors', () => {
    const ancestorSpanIds = ['storedParent'];
    const ancestors = spanAncestorIdsSpy({ spanID: 'a', references: [], ancestorSpanIds } as unknown as TraceSpan);
    ancestors.push('root');

    expect(ancestorSpanIds).toEqual(['storedParent']);
  });

  describe('cyclic references', () => {
    const makeSpan = (spanID: string) => ({ spanID, references: [] as unknown[] });
    const asSpan = (span: { spanID: string }) => span as unknown as TraceSpan;

    // a -> b -> c -> a
    const makeCycle = () => {
      const a = makeSpan('a');
      const b = makeSpan('b');
      const c = makeSpan('c');
      a.references = [{ refType: 'CHILD_OF', span: b }];
      b.references = [{ refType: 'CHILD_OF', span: c }];
      c.references = [{ refType: 'FOLLOWS_FROM', span: a }];
      return { a, b, c };
    };

    it('stops when the references lead back to the span itself', () => {
      expect(spanAncestorIdsSpy(asSpan(makeCycle().a))).toEqual(['b', 'c']);
    });

    it('stops when a span references itself', () => {
      const span = makeSpan('a');
      span.references = [{ refType: 'FOLLOWS_FROM', span }];

      expect(spanAncestorIdsSpy(asSpan(span))).toEqual([]);
    });

    it('stops when the cycle does not include the span itself', () => {
      const { b } = makeCycle();
      const child = makeSpan('child');
      child.references = [{ refType: 'CHILD_OF', span: b }];

      expect(spanAncestorIdsSpy(asSpan(child))).toEqual(['b', 'c', 'a']);
    });
  });
});
