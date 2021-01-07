import React from 'react';
import { PanelProps } from '@grafana/data';
import { Options } from './types';
import { GraphView } from '@grafana/ui/src/components/ServiceMap/GraphView';
import { useLinks } from '../../../features/explore/utils/links';

export const ServiceMapPanel: React.FunctionComponent<PanelProps<Options>> = ({ width, height, data }) => {
  if (!data || !data.series.length) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  const getLinks = useLinks(data.timeRange);

  return (
    <div style={{ width, height }}>
      <GraphView dataFrames={data.series} getLinks={getLinks} />
    </div>
  );
};
