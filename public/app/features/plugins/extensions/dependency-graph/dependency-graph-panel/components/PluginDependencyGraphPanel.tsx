import React, { useMemo } from 'react';

import { PanelProps } from '@grafana/data';

import { PanelOptions } from '../types';
import { getDefaultOptions } from '../utils/helpers/defaults';
import { processPluginDataToGraph } from '../utils/processors/mainProcessor';

import { DependencyGraph } from './DependencyGraph';

interface Props extends PanelProps<PanelOptions> {}

export const PluginDependencyGraphPanel: React.FC<Props> = ({
  options,
  data,
  width,
  height,
  fieldConfig,
  timeZone,
}) => {
  // Merge user options with defaults
  const mergedOptions = useMemo(
    () => ({
      ...getDefaultOptions(),
      ...options,
    }),
    [options]
  );

  // Process the plugin data from data.json into graph format
  const graphData = useMemo(() => {
    return processPluginDataToGraph(mergedOptions);
  }, [mergedOptions]); // Removed 'data' dependency since we no longer use panel data

  return <DependencyGraph data={graphData} options={mergedOptions} width={width} height={height} />;
};
