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

import { type TraceSpan, type TraceSpanReference } from '../types/trace';

import spanAncestorIds from './span-ancestor-ids';

describe('spanAncestorIds', () => {
  const makeSpan = (spanID: string, depth: number, references: Array<Partial<TraceSpanReference>> = []) =>
    ({ spanID, depth, references }) as TraceSpan;

  const root = makeSpan('root', 0);
  const parent = makeSpan('parent', 1, [{ refType: 'CHILD_OF', span: root }]);

  it('returns an empty array if given falsy span', () => {
    expect(spanAncestorIds(null)).toEqual([]);
  });

  it('returns an empty array for a top level span without references', () => {
    expect(spanAncestorIds(root)).toEqual([]);
  });

  it('returns the ids of the spans above in the span tree, nearest first', () => {
    const child = makeSpan('child', 2, [{ refType: 'FOLLOWS_FROM', span: parent }]);

    expect(spanAncestorIds(child)).toEqual(['parent', 'root']);
  });

  it('only follows the first reference of each span', () => {
    const linked = makeSpan('linked', 0);
    const child = makeSpan('child', 2, [
      { refType: 'CHILD_OF', span: parent },
      { refType: 'FOLLOWS_FROM', span: linked },
    ]);

    expect(spanAncestorIds(child)).toEqual(['parent', 'root']);
  });

  it('returns no ancestors for a top level span that links to one of its descendants', () => {
    const top = makeSpan('top', 0);
    const descendant = makeSpan('descendant', 1, [{ refType: 'CHILD_OF', span: top }]);
    top.references = [{ refType: 'FOLLOWS_FROM', spanID: 'descendant', traceID: 'trace', span: descendant }];

    expect(spanAncestorIds(top)).toEqual([]);
    expect(spanAncestorIds(descendant)).toEqual(['top']);
  });
});
