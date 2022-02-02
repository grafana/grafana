import React from 'react';
import { PanelProps } from '@grafana/data';
import memoizeOne from 'memoize-one';
import { Options } from './types';
import { NodeGraph } from './NodeGraph';
import { getNodeGraphDataFrames } from './utils';
import { useLinks } from '../../../features/explore/utils/links';

export const NodeGraphPanel: React.FunctionComponent<PanelProps<Options>> = ({ width, height, data }) => {
  const getLinks = useLinks(data.timeRange);
  if (!data || !data.series.length) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  const memoizedGetNodeGraphDataFrames = memoizeOne(getNodeGraphDataFrames);
  return (
    <div style={{ width, height }}>
      <NodeGraph dataFrames={memoizedGetNodeGraphDataFrames(data.series)} getLinks={getLinks} />
    </div>
  );
};
