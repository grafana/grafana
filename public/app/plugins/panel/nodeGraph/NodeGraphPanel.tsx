import memoizeOne from 'memoize-one';
import React from 'react';

import { PanelProps } from '@grafana/data';

import { useLinks } from '../../../features/explore/utils/links';

import { NodeGraph } from './NodeGraph';
import { NodeGraphOptions } from './types';
import { getNodeGraphDataFrames } from './utils';

export const NodeGraphPanel = ({ width, height, data, options }: PanelProps<NodeGraphOptions>) => {
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
      <NodeGraph dataFrames={memoizedGetNodeGraphDataFrames(data.series, options)} getLinks={getLinks} />
    </div>
  );
};
