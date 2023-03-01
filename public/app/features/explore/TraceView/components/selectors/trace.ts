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

import { createSelector, createStructuredSelector } from 'reselect';

import { Trace, TraceData, TraceProcess, TraceResponse, TraceSpanData } from '../types/trace';
import TreeNode from '../utils/TreeNode';
import { formatMillisecondTime, formatSecondTime, ONE_SECOND } from '../utils/date';
import { numberSortComparator } from '../utils/sort';

import { getProcessServiceName } from './process';
import {
  getSpanId,
  getSpanName,
  getSpanServiceName,
  getSpanTimestamp,
  getSpanDuration,
  getSpanProcessId,
} from './span';

export const getTraceId = (trace: TraceData) => trace.traceID;
export const getTraceSpans = (trace: TraceResponse) => trace.spans;
const getTraceProcesses = (trace: TraceData | Trace) => trace.processes;

const getSpanWithProcess = createSelector(
  (state: { span: TraceSpanData; processes: Record<string, TraceProcess> }) => state.span,
  (state: { span: TraceSpanData; processes: Record<string, TraceProcess> }) => state.processes,
  (span, processes) => ({
    ...span,
    process: processes[getSpanProcessId(span)],
  })
);

export const getTraceSpansAsMap = createSelector(getTraceSpans, (spans) =>
  spans.reduce((map, span: TraceSpanData) => map.set(getSpanId(span), span), new Map())
);

export const TREE_ROOT_ID = '__root__';

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
 * @param  {Trace} trace The trace to build the tree of spanIDs.
 * @return {TreeNode}    A tree of spanIDs derived from the relationships
 *                       between spans in the trace.
 */
export function getTraceSpanIdsAsTree(trace: TraceResponse) {
  const nodesById = new Map(trace.spans.map((span: TraceSpanData) => [span.spanID, new TreeNode(span.spanID)]));
  const spansById = new Map(trace.spans.map((span: TraceSpanData) => [span.spanID, span]));
  const root = new TreeNode(TREE_ROOT_ID);
  trace.spans.forEach((span: TraceSpanData) => {
    const node = nodesById.get(span.spanID)!;
    if (Array.isArray(span.references) && span.references.length) {
      const { refType, spanID: parentID } = span.references[0];
      if (refType === 'CHILD_OF' || refType === 'FOLLOWS_FROM') {
        const parent = nodesById.get(parentID) || root;
        parent.children?.push(node);
      } else {
        throw new Error(`Unrecognized ref type: ${refType}`);
      }
    } else {
      root.children.push(node);
    }
  });
  const comparator = (nodeA: TreeNode | undefined, nodeB: TreeNode | undefined) => {
    const a: TraceSpanData | undefined = nodeA?.value ? spansById.get(nodeA.value.toString()) : undefined;
    const b: TraceSpanData | undefined = nodeB?.value ? spansById.get(nodeB.value.toString()) : undefined;
    return +(a?.startTime! > b?.startTime!) || +(a?.startTime === b?.startTime) - 1;
  };
  trace.spans.forEach((span: TraceSpanData) => {
    const node: TreeNode | undefined = nodesById.get(span.spanID);
    if (node!.children.length > 1) {
      node?.children.sort(comparator);
    }
  });
  root.children.sort(comparator);
  return root;
}

// attach "process" as an object to each span.
export const hydrateSpansWithProcesses = (trace: TraceResponse) => {
  const spans = getTraceSpans(trace);
  const processes = getTraceProcesses(trace);

  return {
    ...trace,
    spans: spans.map((span: TraceSpanData) => getSpanWithProcess({ span, processes })),
  };
};

export const getTraceSpanCount = createSelector(getTraceSpans, (spans) => spans.length);

export const getTraceTimestamp = createSelector(getTraceSpans, (spans) =>
  spans.reduce(
    (prevTimestamp: number, span: TraceSpanData) =>
      prevTimestamp ? Math.min(prevTimestamp, getSpanTimestamp(span)) : getSpanTimestamp(span),
    0
  )
);

export const getTraceDuration = createSelector(getTraceSpans, getTraceTimestamp, (spans, timestamp) =>
  spans.reduce(
    (prevDuration: number, span: TraceSpanData) =>
      prevDuration
        ? Math.max(getSpanTimestamp(span) - timestamp! + getSpanDuration(span), prevDuration)
        : getSpanDuration(span),
    0
  )
);

export const getParentSpan = createSelector(
  getTraceSpanIdsAsTree,
  getTraceSpansAsMap,
  (tree, spanMap) =>
    tree.children
      .map((node: TreeNode) => spanMap.get(node.value))
      .sort((spanA: TraceSpanData, spanB: TraceSpanData) =>
        numberSortComparator(getSpanTimestamp(spanA), getSpanTimestamp(spanB))
      )[0]
);

export const getTraceDepth = createSelector(getTraceSpanIdsAsTree, (spanTree) => spanTree.depth - 1);

export const getSpanDepthForTrace = createSelector(
  createSelector((state: { trace: TraceResponse }) => state.trace, getTraceSpanIdsAsTree),
  createSelector((state: { span: TraceSpanData }) => state.span, getSpanId),
  (node, spanID) => node.getPath(spanID)!.length - 1
);

export const getTraceServices = createSelector(getTraceProcesses, (processes) =>
  Object.keys(processes).reduce(
    (services, processID) => services.add(getProcessServiceName(processes[processID])),
    new Set()
  )
);

export const getTraceServiceCount = createSelector(getTraceServices, (services) => services.size);

// establish constants to determine how math should be handled
// for nanosecond-to-millisecond conversions.
export const DURATION_FORMATTERS = {
  ms: formatMillisecondTime,
  s: formatSecondTime,
};

const getDurationFormatterForTrace = createSelector(getTraceDuration, (totalDuration: number) =>
  totalDuration >= ONE_SECOND ? DURATION_FORMATTERS.s : DURATION_FORMATTERS.ms
);

export const formatDurationForUnit = createSelector(
  ({ duration }: { duration: number }) => duration,
  ({ unit }: { unit: 'ms' | 's' }) => DURATION_FORMATTERS[unit],
  (duration, formatter) => formatter(duration)
);

export const formatDurationForTrace = createSelector(
  ({ duration }: { duration: number }) => duration,
  createSelector(({ trace }: { trace: TraceResponse }) => trace, getDurationFormatterForTrace),
  (duration, formatter) => formatter(duration)
);

export const getSortedSpans = createSelector(
  ({ trace }: { trace: TraceResponse }) => trace,
  ({ spans }: { spans: TraceSpanData[] }) => spans,
  ({
    sort,
  }: {
    sort: {
      dir: number;
      comparator: (itemA: number, itemB: number) => number;
      selector: (itemA: TraceSpanData, itemB: TraceResponse) => number;
    };
  }) => sort,
  (trace, spans, { dir, comparator, selector }) =>
    [...spans].sort((spanA, spanB) => dir * comparator(selector(spanA, trace), selector(spanB, trace)))
);

export const getTreeSizeForTraceSpan = createSelector(
  createSelector((state: { trace: TraceResponse }) => state.trace, getTraceSpanIdsAsTree),
  createSelector((state: { span: TraceSpanData }) => state.span, getSpanId),
  (tree, spanID) => {
    const node = tree.find(spanID);
    if (!node) {
      return -1;
    }
    return node.size - 1;
  }
);

export const getTraceName = createSelector(
  createSelector(
    createSelector(hydrateSpansWithProcesses, getParentSpan),
    createStructuredSelector({
      name: getSpanName,
      serviceName: getSpanServiceName,
    })
  ),
  ({ name, serviceName }: { name: string; serviceName: string }) => `${serviceName}: ${name}`
);

export const omitCollapsedSpans = createSelector(
  ({ spans }: { spans: TraceSpanData[] }) => spans,
  createSelector(({ trace }: { trace: TraceResponse }) => trace, getTraceSpanIdsAsTree),
  ({ collapsed }: { collapsed: string[] }) => collapsed,
  (spans, tree, collapse) => {
    const hiddenSpanIds = collapse.reduce((result, collapsedSpanId) => {
      tree.find(collapsedSpanId)!.walk((id: string | number | undefined) => id !== collapsedSpanId && result.add(id));
      return result;
    }, new Set());

    return hiddenSpanIds.size > 0 ? spans.filter((span) => !hiddenSpanIds.has(getSpanId(span))) : spans;
  }
);

export const DEFAULT_TICK_INTERVAL = 4;
export const DEFAULT_TICK_WIDTH = 3;
export const getTicksForTrace = createSelector(
  ({ trace }: { trace: TraceResponse }) => trace,
  ({ interval = DEFAULT_TICK_INTERVAL }: { interval?: number }) => interval,
  ({ width = DEFAULT_TICK_WIDTH }: { width?: number }) => width,
  (
    trace,
    interval: number,
    width: number
    // timestamps will be spaced over the interval, starting from the initial timestamp
  ) =>
    [...Array(interval + 1).keys()].map((num) => ({
      timestamp: getTraceTimestamp(trace) + getTraceDuration(trace) * (num / interval),
      width,
    }))
);
