import React, { useCallback, useMemo } from 'react';
import { DataFrame, PanelProps } from '@grafana/data';
import { Options } from './types';
import { GraphView } from '@grafana/ui/src/components/ServiceMap/GraphView';
import { getFieldLinksForExplore } from '../../../features/explore/utils/links';
import { ServiceMapLinkDatum, ServiceMapNodeDatum } from '@grafana/ui';

export const ServiceMapPanel: React.FunctionComponent<PanelProps<Options>> = ({
  width,
  height,
  data,
  timeZone,
  options,
}) => {
  if (!data || !data.series.length) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  const { edges, nodes } = useMemo(() => {
    const serviceMapFrames = data.series.filter(frame => frame.meta?.preferredVisualisationType === 'serviceMap');
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
  }, [data.series]);

  const getNodeLinks = useCallback(
    (node: ServiceMapNodeDatum) => {
      // TODO: maybe we can just scan all fields for links instead of hardcoding it here like this
      const field = nodes[0].fields.find(f => f.name === 'query');
      if (field) {
        return getFieldLinksForExplore({ field: field!, rowIndex: node.dataFrameRowIndex, range: data.timeRange });
      } else {
        return [];
      }
    },
    [data.timeRange, nodes[0]]
  );

  const getEdgeLinks = useCallback(
    (link: ServiceMapLinkDatum) => {
      // TODO: maybe we can just scan all fields for links instead of hardcoding it here like this
      const field = edges[0].fields.find(f => f.name === 'query');
      if (field) {
        return getFieldLinksForExplore({ field: field!, rowIndex: link.dataFrameRowIndex, range: data.timeRange });
      } else {
        return [];
      }
    },
    [data.timeRange, nodes[0]]
  );

  return (
    <div style={{ width, height }}>
      <GraphView services={nodes[0]} edges={edges[0]} getEdgeLinks={getEdgeLinks} getNodeLinks={getNodeLinks} />
    </div>
  );
};
