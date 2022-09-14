/**
 * Get non overlapping duration of the ranges as they can overlap or have gaps.
 */
import { FieldType, MutableDataFrame, NodeGraphDataFrameFieldNames as Fields } from '@grafana/data';

export function getNonOverlappingDuration(ranges: Array<[number, number]>): number {
  ranges.sort((a, b) => a[0] - b[0]);
  const mergedRanges = ranges.reduce((acc, range) => {
    if (!acc.length) {
      return [range];
    }
    const tail = acc.slice(-1)[0];
    const [prevStart, prevEnd] = tail;
    const [start, end] = range;
    if (end < prevEnd) {
      // In this case the range is completely inside the prev range so we can just ignore it.
      return acc;
    }

    if (start > prevEnd) {
      // There is no overlap so we can just add it to stack
      return [...acc, range];
    }

    // We know there is overlap and current range ends later than previous so we can just extend the range
    return [...acc.slice(0, -1), [prevStart, end]] as Array<[number, number]>;
  }, [] as Array<[number, number]>);

  return mergedRanges.reduce((acc, range) => {
    return acc + (range[1] - range[0]);
  }, 0);
}

/**
 * Returns a map of the spans with children array for easier processing. It will also contain empty spans in case
 * span is missing but other spans are its children. This is more generic because it needs to allow iterating over
 * both arrays and dataframe views.
 */
export function makeSpanMap<T>(getSpan: (index: number) => { span: T; id: string; parentIds: string[] } | undefined): {
  [id: string]: { span: T; children: string[] };
} {
  const spanMap: { [id: string]: { span?: T; children: string[] } } = {};

  let span;
  for (let index = 0; (span = getSpan(index)), !!span; index++) {
    if (!spanMap[span.id]) {
      spanMap[span.id] = {
        span: span.span,
        children: [],
      };
    } else {
      spanMap[span.id].span = span.span;
    }

    for (const parentId of span.parentIds) {
      if (parentId) {
        if (!spanMap[parentId]) {
          spanMap[parentId] = {
            span: undefined,
            children: [span.id],
          };
        } else {
          spanMap[parentId].children.push(span.id);
        }
      }
    }
  }
  return spanMap as { [id: string]: { span: T; children: string[] } };
}

export function getStats(duration: number, traceDuration: number, selfDuration: number) {
  return {
    main: `${toFixedNoTrailingZeros(duration)}ms (${toFixedNoTrailingZeros((duration / traceDuration) * 100)}%)`,
    secondary: `${toFixedNoTrailingZeros(selfDuration)}ms (${toFixedNoTrailingZeros(
      (selfDuration / duration) * 100
    )}%)`,
  };
}

function toFixedNoTrailingZeros(n: number) {
  return parseFloat(n.toFixed(2));
}

/**
 * Create default frames used when returning data for node graph.
 */
export function makeFrames() {
  const nodesFrame = new MutableDataFrame({
    fields: [
      { name: Fields.id, type: FieldType.string },
      { name: Fields.title, type: FieldType.string },
      { name: Fields.subTitle, type: FieldType.string },
      { name: Fields.mainStat, type: FieldType.string, config: { displayName: 'Total time (% of trace)' } },
      { name: Fields.secondaryStat, type: FieldType.string, config: { displayName: 'Self time (% of total)' } },
      {
        name: Fields.color,
        type: FieldType.number,
        config: { color: { mode: 'continuous-GrYlRd' }, displayName: 'Self time / Trace duration' },
      },
    ],
    meta: {
      preferredVisualisationType: 'nodeGraph',
    },
  });

  const edgesFrame = new MutableDataFrame({
    fields: [
      { name: Fields.id, type: FieldType.string },
      { name: Fields.target, type: FieldType.string },
      { name: Fields.source, type: FieldType.string },
    ],
    meta: {
      preferredVisualisationType: 'nodeGraph',
    },
  });

  return [nodesFrame, edgesFrame];
}
