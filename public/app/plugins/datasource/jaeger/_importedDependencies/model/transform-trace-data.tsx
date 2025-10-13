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

import { isEqual as _isEqual } from 'lodash';

import { TraceKeyValuePair } from '@grafana/data';

import { getTraceSpanIdsAsTree } from '../selectors/trace';
import { TraceSpan, Trace, TraceResponse, TraceProcess } from '../types';
import TreeNode from '../utils/TreeNode';
import { getConfigValue } from '../utils/config/get-config';

import { getTraceName } from './trace-viewer';

function deduplicateTags(tags: TraceKeyValuePair[]) {
  const warningsHash: Map<string, string> = new Map<string, string>();
  const dedupedTags: TraceKeyValuePair[] = tags.reduce<TraceKeyValuePair[]>((uniqueTags, tag) => {
    if (!uniqueTags.some((t) => t.key === tag.key && t.value === tag.value)) {
      uniqueTags.push(tag);
    } else {
      warningsHash.set(`${tag.key}:${tag.value}`, `Duplicate tag "${tag.key}:${tag.value}"`);
    }
    return uniqueTags;
  }, []);
  const warnings = Array.from(warningsHash.values());
  return { dedupedTags, warnings };
}

function orderTags(tags: TraceKeyValuePair[], topPrefixes?: string[]) {
  const orderedTags: TraceKeyValuePair[] = tags?.slice() ?? [];
  const tp = (topPrefixes || []).map((p: string) => p.toLowerCase());

  orderedTags.sort((a, b) => {
    const aKey = a.key.toLowerCase();
    const bKey = b.key.toLowerCase();

    for (let i = 0; i < tp.length; i++) {
      const p = tp[i];
      if (aKey.startsWith(p) && !bKey.startsWith(p)) {
        return -1;
      }
      if (!aKey.startsWith(p) && bKey.startsWith(p)) {
        return 1;
      }
    }

    if (aKey > bKey) {
      return 1;
    }
    if (aKey < bKey) {
      return -1;
    }
    return 0;
  });

  return orderedTags;
}

/**
 * NOTE: Mutates `data` - Transform the HTTP response data into the form the app
 * generally requires.
 */
export default function transformTraceData(data: TraceResponse | undefined): Trace | null {
  if (!data?.traceID) {
    return null;
  }
  const traceID = data.traceID.toLowerCase();

  let traceEndTime = 0;
  let traceStartTime = Number.MAX_SAFE_INTEGER;
  const spanIdCounts = new Map();
  const spanMap = new Map<string, TraceSpan>();
  // filter out spans with empty start times
  // eslint-disable-next-line no-param-reassign
  data.spans = data.spans.filter((span) => Boolean(span.startTime));

  // Sort process tags
  data.processes = Object.entries(data.processes).reduce<Record<string, TraceProcess>>((processes, [id, process]) => {
    processes[id] = {
      ...process,
      tags: orderTags(process.tags),
    };
    return processes;
  }, {});

  const max = data.spans.length;
  for (let i = 0; i < max; i++) {
    const span: TraceSpan = data.spans[i] as TraceSpan;
    const { startTime, duration, processID } = span;

    let spanID = span.spanID;
    // check for start / end time for the trace
    if (startTime < traceStartTime) {
      traceStartTime = startTime;
    }
    if (startTime + duration > traceEndTime) {
      traceEndTime = startTime + duration;
    }
    // make sure span IDs are unique
    const idCount = spanIdCounts.get(spanID);
    if (idCount != null) {
      // eslint-disable-next-line no-console
      console.warn(`Dupe spanID, ${idCount + 1} x ${spanID}`, span, spanMap.get(spanID));
      if (_isEqual(span, spanMap.get(spanID))) {
        // eslint-disable-next-line no-console
        console.warn('\t two spans with same ID have `isEqual(...) === true`');
      }
      spanIdCounts.set(spanID, idCount + 1);
      spanID = `${spanID}_${idCount}`;
      span.spanID = spanID;
    } else {
      spanIdCounts.set(spanID, 1);
    }
    span.process = data.processes[processID];
    spanMap.set(spanID, span);
  }
  // tree is necessary to sort the spans, so children follow parents, and
  // siblings are sorted by start time
  const tree = getTraceSpanIdsAsTree(data, spanMap);
  const spans: TraceSpan[] = [];
  const svcCounts: Record<string, number> = {};

  tree.walk((spanID: string, node: TreeNode<string>, depth = 0) => {
    if (spanID === '__root__') {
      return;
    }
    if (typeof spanID !== 'string') {
      return;
    }
    const span = spanMap.get(spanID);
    if (!span) {
      return;
    }
    const { serviceName } = span.process;
    svcCounts[serviceName] = (svcCounts[serviceName] || 0) + 1;
    span.relativeStartTime = span.startTime - traceStartTime;
    span.depth = depth - 1;
    span.hasChildren = node.children.length > 0;
    span.childSpanCount = node.children.length;
    span.warnings = span.warnings || [];
    span.tags = span.tags || [];
    span.references = span.references || [];

    span.childSpanIds = node.children
      .slice()
      .sort((a, b) => {
        const spanA = spanMap.get(a.value)!;
        const spanB = spanMap.get(b.value)!;
        return spanB.startTime + spanB.duration - (spanA.startTime + spanA.duration);
      })
      .map((each) => each.value);

    const tagsInfo = deduplicateTags(span.tags);
    span.tags = orderTags(tagsInfo.dedupedTags, getConfigValue('topTagPrefixes'));
    span.warnings = span.warnings.concat(tagsInfo.warnings);
    span.references.forEach((ref, index) => {
      const refSpan = spanMap.get(ref.spanID);
      if (refSpan) {
        // eslint-disable-next-line no-param-reassign
        ref.span = refSpan;
        if (index > 0) {
          // Don't take into account the parent, just other references.
          refSpan.subsidiarilyReferencedBy = refSpan.subsidiarilyReferencedBy || [];
          refSpan.subsidiarilyReferencedBy.push({
            spanID,
            traceID,
            span,
            refType: ref.refType,
          });
        }
      }
    });
    spans.push(span);
  });
  const traceName = getTraceName(spans);
  const services = Object.keys(svcCounts).map((name) => ({ name, numberOfSpans: svcCounts[name] }));
  return {
    services,
    spans,
    traceID,
    traceName,
    // can't use spread operator for intersection types
    // repl: https://goo.gl/4Z23MJ
    // issue: https://github.com/facebook/flow/issues/1511
    processes: data.processes,
    duration: traceEndTime - traceStartTime,
    startTime: traceStartTime,
    endTime: traceEndTime,
  };
}
