import {
  getActiveContentConsumers,
  getAvailableContentConsumers,
  getAvailableContentProviders,
  getDefaultOptions,
  processPluginDataToGraph,
} from '../../sunker-plugindependencygraph-plugin/utils/dataProcessor';

import { logGraphData } from '../utils/logger';
import { useMemo } from 'react';

export type VisualizationMode = 'add' | 'expose';

export interface DependencyGraphOptions {
  visualizationMode: VisualizationMode;
  selectedContentProviders: string[];
  selectedContentConsumers: string[];
}

export interface DependencyGraphData {
  graphData: ReturnType<typeof processPluginDataToGraph>;
  availableProviders: string[];
  availableConsumers: string[];
  activeConsumers: string[];
  contentProviderOptions: Array<{ label: string; value: string }>;
  contentConsumerOptions: Array<{ label: string; value: string }>;
  selectedProviderValues: string[];
  selectedConsumerValues: string[];
}

/**
 * Custom hook for managing dependency graph data and options
 */
export function useDependencyGraphData({
  visualizationMode,
  selectedContentProviders,
  selectedContentConsumers,
}: DependencyGraphOptions): DependencyGraphData {
  // Get available providers and consumers based on visualization mode
  const availableProviders = useMemo(() => getAvailableContentProviders(visualizationMode), [visualizationMode]);

  const availableConsumers = useMemo(() => getAvailableContentConsumers(visualizationMode), [visualizationMode]);

  const activeConsumers = useMemo(() => getActiveContentConsumers(visualizationMode), [visualizationMode]);

  // Create options for multi-comboboxes
  const contentProviderOptions = useMemo(
    () =>
      availableProviders.map((provider) => ({
        label: provider === 'grafana-core' ? 'Grafana Core' : provider,
        value: provider,
      })),
    [availableProviders]
  );

  const contentConsumerOptions = useMemo(
    () =>
      availableConsumers.map((consumer) => ({
        label: consumer === 'grafana-core' ? 'Grafana Core' : consumer,
        value: consumer,
      })),
    [availableConsumers]
  );

  // Calculate selected values for display
  const selectedProviderValues = useMemo(
    () =>
      !selectedContentProviders || selectedContentProviders.length === 0
        ? availableProviders
        : selectedContentProviders,
    [selectedContentProviders, availableProviders]
  );

  const selectedConsumerValues = useMemo(
    () =>
      !selectedContentConsumers || selectedContentConsumers.length === 0 ? activeConsumers : selectedContentConsumers,
    [selectedContentConsumers, activeConsumers]
  );

  // Process the plugin data for the dependency graph
  const graphData = useMemo(() => {
    const options = {
      ...getDefaultOptions(),
      visualizationMode,
      showDependencyTypes: true,
      showDescriptions: false,
      selectedContentProviders,
      selectedContentConsumers,
      linkExtensionColor: '#37872d',
      componentExtensionColor: '#ff9900',
      functionExtensionColor: '#e02f44',
    };
    const data = processPluginDataToGraph(options);
    logGraphData(data);
    return data;
  }, [visualizationMode, selectedContentProviders, selectedContentConsumers]);

  return {
    graphData,
    availableProviders,
    availableConsumers,
    activeConsumers,
    contentProviderOptions,
    contentConsumerOptions,
    selectedProviderValues,
    selectedConsumerValues,
  };
}
