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

import { values as _values } from 'lodash';

import type TreeNode from 'app/features/explore/TraceView/components/utils/TreeNode';

import traceGenerator from '../demo/trace-generators';
import { type TraceResponse } from '../types/trace';

import { getSpanId, getSpanParentId } from './span';
import * as traceSelectors from './trace';
import { followsFromRef } from './trace.fixture';

const generatedTrace: TraceResponse = traceGenerator.trace({ numberOfSpans: 45 });

it('getTraceSpansAsMap() should return a map of all of the spans', () => {
  const spanMap = traceSelectors.getTraceSpansAsMap(generatedTrace);
  [...spanMap.entries()].forEach((pair) => {
    expect(pair[1]).toEqual(generatedTrace.spans.find((span) => getSpanId(span) === pair[0]));
  });
});

describe('getTraceSpanIdsAsTree()', () => {
  it('builds the tree properly', () => {
    const tree = traceSelectors.getTraceSpanIdsAsTree(generatedTrace);
    const spanMap = traceSelectors.getTraceSpansAsMap(generatedTrace);

    tree.walk((value: string, node: TreeNode<string>) => {
      const expectedParentValue = value === traceSelectors.TREE_ROOT_ID ? null : value;
      node.children.forEach((childNode) => {
        expect(getSpanParentId(spanMap.get(childNode.value))).toBe(expectedParentValue);
      });
    });
  });

  it('#115 - handles FOLLOW_FROM refs', () => {
    expect(() => traceSelectors.getTraceSpanIdsAsTree(followsFromRef)).not.toThrow();
  });

  describe('cyclic references', () => {
    const traceID = 'trace';
    const ref = (refType: 'CHILD_OF' | 'FOLLOWS_FROM', spanID: string) => ({ refType, traceID, spanID });
    const makeSpan = (spanID: string, startTime: number, references: Array<ReturnType<typeof ref>>) => ({
      traceID,
      spanID,
      startTime,
      references,
    });
    const buildTree = (spans: Array<ReturnType<typeof makeSpan>>) =>
      traceSelectors.getTraceSpanIdsAsTree({ traceID, spans } as unknown as TraceResponse);
    const childValues = (node: TreeNode<string>) => node.children.map((child) => child.value);

    it('attaches the span linking to its own child to the root', () => {
      const tree = buildTree([
        makeSpan('root', 1, [ref('FOLLOWS_FROM', 'child')]),
        makeSpan('child', 2, [ref('CHILD_OF', 'root')]),
      ]);

      expect(childValues(tree)).toEqual(['root']);
      expect(childValues(tree.children[0])).toEqual(['child']);
    });

    it('attaches a span whose only reference is a link to itself to the root', () => {
      const tree = buildTree([makeSpan('a', 1, [ref('FOLLOWS_FROM', 'a')])]);

      expect(childValues(tree)).toEqual(['a']);
      expect(childValues(tree.children[0])).toEqual([]);
    });

    it('prefers the span whose edge is a link over the earliest span of the cycle', () => {
      const tree = buildTree([
        makeSpan('early', 1, [ref('CHILD_OF', 'late')]),
        makeSpan('late', 2, [ref('FOLLOWS_FROM', 'early')]),
      ]);

      expect(childValues(tree)).toEqual(['late']);
      expect(childValues(tree.children[0])).toEqual(['early']);
    });

    it('attaches the earliest span of a cycle without links to the root', () => {
      const tree = buildTree([makeSpan('b', 2, [ref('CHILD_OF', 'a')]), makeSpan('a', 1, [ref('CHILD_OF', 'b')])]);

      expect(childValues(tree)).toEqual(['a']);
      expect(childValues(tree.children[0])).toEqual(['b']);
    });

    it('keeps spans below a cycle reachable and leaves other spans in place', () => {
      const tree = buildTree([
        makeSpan('root', 1, []),
        makeSpan('a', 2, [ref('FOLLOWS_FROM', 'b')]),
        makeSpan('b', 3, [ref('FOLLOWS_FROM', 'a')]),
        makeSpan('below-cycle', 4, [ref('CHILD_OF', 'b')]),
      ]);

      expect(childValues(tree)).toEqual(['root', 'a']);
      expect(childValues(tree.children[1])).toEqual(['b']);
      expect(childValues(tree.children[1].children[0])).toEqual(['below-cycle']);
    });
  });
});
