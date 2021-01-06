import { useMemo } from 'react';
import { DataFrame } from '@grafana/data';

/**
 *
 */
export function useCategorizeFrames(series: DataFrame[]) {
  return useMemo(() => {
    const serviceMapFrames = series.filter(frame => frame.meta?.preferredVisualisationType === 'serviceMap');
    return serviceMapFrames.reduce(
      (acc, frame) => {
        const sourceField = frame.fields.filter(f => f.name === 'source');
        if (sourceField.length) {
          acc.edges.push(frame);
        } else {
          acc.nodes.push(frame);
        }
        return acc;
      },
      { edges: [], nodes: [] } as { nodes: DataFrame[]; edges: DataFrame[] }
    );
  }, [series]);
}
