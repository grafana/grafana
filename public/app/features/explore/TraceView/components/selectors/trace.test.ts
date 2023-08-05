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

import TreeNode from 'app/features/explore/TraceView/components/utils/TreeNode';

import traceGenerator from '../demo/trace-generators';
import { TraceResponse } from '../types/trace';

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

    tree.walk((value: string | number | undefined, node: TreeNode) => {
      const expectedParentValue = value === traceSelectors.TREE_ROOT_ID ? null : value;
      node.children.forEach((childNode) => {
        expect(getSpanParentId(spanMap.get(childNode.value))).toBe(expectedParentValue);
      });
    });
  });

  it('#115 - handles FOLLOW_FROM refs', () => {
    expect(() => traceSelectors.getTraceSpanIdsAsTree(followsFromRef)).not.toThrow();
  });
});
