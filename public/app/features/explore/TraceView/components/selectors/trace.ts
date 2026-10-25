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

import { createSelector } from 'reselect';

import { type TraceResponse, type TraceSpanData } from '../types/trace';
import TreeNode from '../utils/TreeNode';

import { getSpanId } from './span';

const getTraceSpans = (trace: TraceResponse) => trace.spans;

export const getTraceSpansAsMap = createSelector(getTraceSpans, (spans) =>
  spans.reduce((map, span: TraceSpanData) => map.set(getSpanId(span), span), new Map())
);

export const TREE_ROOT_ID = '__root__';

/**
 * Breaks every cycle in the span -> parent mapping by clearing the parent of one span per cycle.
 *
 * FOLLOWS_FROM references are also what OpenTelemetry links are turned into, and they can point at a
 * descendant. A span whose tree edge is such a link is the better root of its cycle than one with a real
 * CHILD_OF parent. Among equally good candidates the earliest span wins.
 */
function detachParentCycles(
  spans: TraceSpanData[],
  parentIds: Map<string, string | undefined>,
  spansById: Map<string, TraceSpanData>
) {
  const visited = new Set<string>();
  spans.forEach((span) => {
    const path: string[] = [];
    let id: string | undefined = span.spanID;
    while (id !== undefined && !visited.has(id)) {
      visited.add(id);
      path.push(id);
      id = parentIds.get(id);
    }
    // The walk stopped on a span from this very path only if it closed a cycle.
    if (id !== undefined && path.includes(id)) {
      const cycle = path.slice(path.indexOf(id));
      const linked = cycle.filter((cycleId) => spansById.get(cycleId)?.references?.[0]?.refType === 'FOLLOWS_FROM');
      const candidates = linked.length ? linked : cycle;
      const earliest = candidates.reduce((best, current) =>
        spansById.get(current)!.startTime < spansById.get(best)!.startTime ? current : best
      );
      parentIds.set(earliest, undefined);
    }
  });
}

/**
 * Build a tree of { value: spanID, children } items derived from the
 * `span.references` information. The tree represents the grouping of parent /
 * child relationships. The root-most node is nominal in that
 * `.value === TREE_ROOT_ID`. This is done because a root span (the main trace
 * span) is not always included with the trace data. Thus, there can be
 * multiple top-level spans, and the root node acts as their common parent.
 *
 * The children are sorted by `span.startTime` after the tree is built.
 *
 * Spans whose references form a cycle would otherwise be unreachable from the
 * root, so one span of each cycle is attached to the root instead.
 *
 * @param  {Trace} trace The trace to build the tree of spanIDs.
 * @return {TreeNode}    A tree of spanIDs derived from the relationships
 *                       between spans in the trace.
 */
export function getTraceSpanIdsAsTree(trace: TraceResponse, spanMap: Map<string, TraceSpanData> | null = null) {
  const nodesById = new Map(trace.spans.map((span: TraceSpanData) => [span.spanID, new TreeNode(span.spanID)]));
  const spansById = spanMap ?? new Map(trace.spans.map((span: TraceSpanData) => [span.spanID, span]));
  const root = new TreeNode(TREE_ROOT_ID);
  // A span without a parent id is a child of the root node.
  const parentIds = new Map<string, string | undefined>();
  trace.spans.forEach((span: TraceSpanData) => {
    if (Array.isArray(span.references) && span.references.length) {
      const { refType, spanID: parentID } = span.references[0];
      if (refType === 'CHILD_OF' || refType === 'FOLLOWS_FROM') {
        parentIds.set(span.spanID, nodesById.has(parentID) ? parentID : undefined);
      } else {
        throw new Error(`Unrecognized ref type: ${refType}`);
      }
    } else {
      parentIds.set(span.spanID, undefined);
    }
  });
  detachParentCycles(trace.spans, parentIds, spansById);
  trace.spans.forEach((span: TraceSpanData) => {
    const parentId = parentIds.get(span.spanID);
    const parent = parentId === undefined ? root : nodesById.get(parentId)!;
    parent.children.push(nodesById.get(span.spanID)!);
  });
  const comparator = (nodeA: TreeNode<string>, nodeB: TreeNode<string>) => {
    const a: TraceSpanData | undefined = nodeA?.value ? spansById.get(nodeA.value.toString()) : undefined;
    const b: TraceSpanData | undefined = nodeB?.value ? spansById.get(nodeB.value.toString()) : undefined;
    return +(a?.startTime! > b?.startTime!) || +(a?.startTime === b?.startTime) - 1;
  };
  trace.spans.forEach((span: TraceSpanData) => {
    const node = nodesById.get(span.spanID);
    if (node!.children.length > 1) {
      node?.children.sort(comparator);
    }
  });
  root.children.sort(comparator);
  return root;
}
