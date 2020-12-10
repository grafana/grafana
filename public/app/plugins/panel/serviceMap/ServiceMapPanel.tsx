import React from 'react';
import { PanelProps } from '@grafana/data';
import { Options } from './types';
import { GraphView } from '@grafana/ui/src/components/ServiceMap/GraphView';
import { useLinks } from '../../../features/explore/utils/links';
import { useCategorizeFramesForGraph } from '@grafana/ui';

export const ServiceMapPanel: React.FunctionComponent<PanelProps<Options>> = ({ width, height, data }) => {
  if (!data || !data.series.length) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  const { edges, nodes } = useCategorizeFramesForGraph(data.series);
  const getNodeLinks = useLinks(nodes[0], data.timeRange);
  const getEdgeLinks = useLinks(edges[0], data.timeRange);

  return (
    <div style={{ width, height }}>
      <GraphView services={nodes[0]} edges={edges[0]} getEdgeLinks={getEdgeLinks} getNodeLinks={getNodeLinks} />
    </div>
  );
};
