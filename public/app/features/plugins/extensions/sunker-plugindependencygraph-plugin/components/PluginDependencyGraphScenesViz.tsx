import { useMemo } from 'react';

import { PanelProps } from '@grafana/data';

import { PanelOptions } from '../types';
import { getDefaultOptions, processPluginDataToGraph } from '../utils/dataProcessor';

import { DependencyGraph } from './DependencyGraph';


interface CustomVizOptions {
  visualizationMode: 'add' | 'expose';
  showDependencyTypes: boolean;
  showDescriptions: boolean;
  selectedContentProviders: string[];
  selectedContentConsumers: string[];
  linkExtensionColor: string;
  componentExtensionColor: string;
  functionExtensionColor: string;
}

interface Props extends PanelProps<CustomVizOptions> {}

export function PluginDependencyGraphScenesViz(props: Props) {
  const { options, width, height } = props;

  // Merge user options with defaults
  const mergedOptions = useMemo(
    (): PanelOptions => ({
      ...getDefaultOptions(),
      ...options,
    }),
    [options]
  );

  // Process the plugin data from data.json into graph format
  const graphData = useMemo(() => {
    return processPluginDataToGraph(mergedOptions);
  }, [mergedOptions]);

  return <DependencyGraph data={graphData} options={mergedOptions} width={width} height={height} />;
}
