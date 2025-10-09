import React, { useMemo } from 'react';

import { PanelProps } from '@grafana/data';

import { PanelOptions } from '../types';
import { getDefaultOptions } from '../utils/helpers/defaults';
import { processPluginDataToGraph } from '../utils/processors/mainProcessor';

import { DependencyGraph } from './DependencyGraph';

interface Props extends PanelProps<PanelOptions> {}

/**
 * Main panel component for the Plugin Dependency Graph visualization.
 *
 * This component renders an interactive graph showing relationships between Grafana plugins,
 * including extension points, exposed components, and various types of plugin extensions.
 *
 * @param options - Panel configuration options including visualization mode and styling
 * @param data - Grafana data source data (currently unused, uses data.json instead)
 * @param width - Panel width in pixels
 * @param height - Panel height in pixels
 * @param fieldConfig - Grafana field configuration
 * @param timeZone - Timezone for data processing
 * @returns JSX element containing the dependency graph visualization
 *
 * @example
 * ```tsx
 * <PluginDependencyGraphPanel
 *   options={{
 *     visualizationMode: 'extensionpoint',
 *     showDependencyTypes: true,
 *     selectedContentProviders: ['grafana-asserts-app']
 *   }}
 *   data={data}
 *   width={800}
 *   height={600}
 *   fieldConfig={fieldConfig}
 *   timeZone="UTC"
 * />
 * ```
 *
 * @public
 */
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
