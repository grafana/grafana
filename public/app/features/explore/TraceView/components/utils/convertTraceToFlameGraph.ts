import { groupBy, map } from 'lodash';

import { DataFrame, MutableDataFrame } from '@grafana/data';

import { Trace, TraceSpan } from '../types';

interface FlameSpan extends TraceSpan {
  children: FlameSpan[];
  total: number;
  self: number;
}

export function convertTraceToFlameGraph(trace: Trace): DataFrame {
  const result: { names: string[]; levels: number[]; values: number[]; self: number[] } = {
    names: [],
    levels: [],
    values: [],
    self: [],
  };

  // Step 1: converting spans to a tree

  const spans: Record<string, FlameSpan> = {};
  const root: FlameSpan = { children: [] } as unknown as FlameSpan;
  (trace.spans as FlameSpan[]).forEach((span) => {
    span.children = [];
    spans[span.spanID] = span;
  });

  (trace.spans as FlameSpan[]).forEach((span) => {
    let node = root;
    if (span.references && span.references.length > 0) {
      node = spans[span.references[0].spanID] || root;
    }

    node.children.push(span);
  });

  // Step 2: group spans with same name

  function groupSpans(span: FlameSpan, d: number) {
    (span.children || []).forEach((x) => groupSpans(x, d + 1));

    let childrenDur = 0;
    const groups = groupBy(span.children || [], (x) => x.operationName);
    span.children = map(groups, (group) => {
      const res = group[0];
      for (let i = 1; i < group.length; i += 1) {
        res.total += group[i].total;
      }
      childrenDur += res.total;
      return res;
    });
    span.total = Math.max(span.duration, childrenDur);
    span.self = Math.max(0, span.total - childrenDur);
  }
  groupSpans(root, 0);

  // Step 3: traversing the tree

  function processNode(span: FlameSpan, level: number) {
    if (level === 0 && !span.total) {
      level -= 1;
    } else {
      result.levels.push(level);
      result.values.push(span.total * 1000 || 0);
      result.self.push(span.self * 1000 || 0);
      result.names.push(
        (span.processID ? `${trace.processes[span.processID].serviceName}: ` : '') + (span.operationName || 'total')
      );
    }

    (span.children || []).forEach((x) => {
      processNode(x, level + 1);
    });
    return span.total;
  }

  processNode(root, 0);

  return new MutableDataFrame({
    refId: 'A',
    name: trace.traceName,
    // @ts-ignore
    meta: { preferredVisualisationType: 'flamegraph' },
    fields: [
      {
        name: 'level',
        values: result.levels,
        config: {
          unit: 'short',
        },
      },
      {
        name: 'value',
        values: result.values,
        config: {
          unit: 'ns',
        },
      },
      {
        name: 'self',
        values: result.self,
        config: {
          unit: 'ns',
        },
      },
      { name: 'label', values: result.names },
    ],
  });
}
