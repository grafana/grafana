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

import { TraceSpan } from '../types';

import spanAncestorIdsSpy from './span-ancestor-ids';

describe('spanAncestorIdsSpy', () => {
  const rootSpan = { spanID: 'rootSpanID' };
  const firstParentFirstGrandparentSpan = {
    spanID: 'firstParentFirstGrandparentSpanID',
    references: [
      {
        span: rootSpan,
      }
    ],
  };
  const firstParentSecondGrandparentSpan = {
    spanID: 'firstParentSecondGrandparentSpanID',
    references: [
      {
        span: rootSpan,
        refType: 'FOLLOWS_FROM',
      },
    ],
  };
  const firstParentSpan = {
    spanID: 'firstParentSpanID',
    references: [
      {
        span: firstParentFirstGrandparentSpan,
        refType: 'not an ancestor ref type',
      },
      {
        span: firstParentSecondGrandparentSpan,
        refType: 'CHILD_OF',
      },
    ],
  };
  const secondParentSpan = { spanID: 'secondParentSpanID' };
  const span = {
    spanID: 'ownSpanID',
    references: [
      {
        span: firstParentSpan,
        referenceType: 'CHILD_OF',
      },
      {
        span: secondParentSpan,
        referenceType: 'CHILD_OF'
      },
    ],
  };
  
  const expectedAncestorIds = [firstParentSpan.spanID, firstParentSecondGrandparentSpan.spanID, rootSpan.spanID];

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

  it('does not infinitely loop', () => {
    const spanWithLoopedReference = {
      ...span,
      references: [
        {
          ...span.references[0],
          span: {
            ...firstParentSpan,
            references: [
              firstParentSpan.references[0], //firstParentFirstGrandparentSpan
              {
                ...firstParentSpan.references[1],
                span: {
                  ...firstParentSecondGrandparentSpan,
                  references: [
                    ...firstParentSecondGrandparentSpan.references[0],
                    span: {
                      ...rootSpan,
                      references: [
                        {
                          span: span,
                          refType: 'FOLLOWS_FROM',
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    };
    expect(spanAncestorIdsSpy(spanWithLoopedReference as TraceSpan)).toEqual(expectedAncestorIds);
  });
});
