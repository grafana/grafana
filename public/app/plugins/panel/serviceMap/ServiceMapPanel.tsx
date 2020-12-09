import React, { useCallback, useMemo } from 'react';
import { DataFrame, PanelProps, TimeRange } from '@grafana/data';
import { Options } from './types';
import { GraphView } from '@grafana/ui/src/components/ServiceMap/GraphView';
import { getFieldLinksForExplore } from '../../../features/explore/utils/links';

export const ServiceMapPanel: React.FunctionComponent<PanelProps<Options>> = ({ width, height, data }) => {
  if (!data || !data.series.length) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  const { edges, nodes } = useCategorizeFrames(data.series);
  const getNodeLinks = useLinks(nodes[0], data.timeRange);
  const getEdgeLinks = useLinks(edges[0], data.timeRange);

  return (
    <div style={{ width, height }}>
      <GraphView services={nodes[0]} edges={edges[0]} getEdgeLinks={getEdgeLinks} getNodeLinks={getNodeLinks} />
    </div>
  );
};

function useCategorizeFrames(series: DataFrame[]) {
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

function useLinks(dataFrame: DataFrame, range: TimeRange) {
  return useCallback(
    (node: { dataFrameRowIndex: number }) => {
      return dataFrame.fields.flatMap(f => {
        if (f.config?.links && f.config?.links.length) {
          return getFieldLinksForExplore({
            field: f,
            rowIndex: node.dataFrameRowIndex,
            range,
            dataFrame,
          });
        } else {
          return [];
        }
      });
    },
    [range, dataFrame]
  );
}
