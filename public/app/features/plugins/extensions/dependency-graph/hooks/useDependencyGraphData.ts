import { useMemo } from 'react';

import {
  getActiveContentConsumers,
  getAvailableContentConsumers,
  getAvailableContentProviders,
  getAvailableExtensionPoints,
  getDefaultOptions,
  processPluginDataToGraph,
} from '../dependency-graph-panel/utils/dataProcessor';
import { logGraphData } from '../utils/logger';

export type VisualizationMode = 'add' | 'expose' | 'extensionpoint';

export interface DependencyGraphOptions {
  visualizationMode: VisualizationMode;
  selectedContentProviders: string[];
  selectedContentConsumers: string[];
  selectedExtensionPoints?: string[];
}

export interface DependencyGraphData {
  graphData: ReturnType<typeof processPluginDataToGraph>;
  availableProviders: string[];
  availableConsumers: string[];
  availableExtensionPoints: string[];
  activeConsumers: string[];
  contentProviderOptions: Array<{ label: string; value: string }>;
  contentConsumerOptions: Array<{ label: string; value: string }>;
  extensionPointOptions: Array<{ label: string; value: string }>;
  selectedProviderValues: string[];
  selectedConsumerValues: string[];
  selectedExtensionPointValues: string[];
}

/**
 * Custom hook for managing dependency graph data and options
 */
export function useDependencyGraphData({
  visualizationMode,
  selectedContentProviders,
  selectedContentConsumers,
  selectedExtensionPoints,
}: DependencyGraphOptions): DependencyGraphData {
  // Get available providers and consumers based on visualization mode
  const availableProviders = useMemo(() => getAvailableContentProviders(visualizationMode), [visualizationMode]);

  const availableConsumers = useMemo(() => getAvailableContentConsumers(visualizationMode), [visualizationMode]);

  const availableExtensionPoints = useMemo(() => getAvailableExtensionPoints(), []);

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

  const extensionPointOptions = useMemo(
    () =>
      availableExtensionPoints.map((extensionPoint) => ({
        label: extensionPoint,
        value: extensionPoint,
      })),
    [availableExtensionPoints]
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

  const selectedExtensionPointValues = useMemo(
    () =>
      !selectedExtensionPoints || selectedExtensionPoints.length === 0
        ? availableExtensionPoints
        : selectedExtensionPoints,
    [selectedExtensionPoints, availableExtensionPoints]
  );

  // Process the plugin data for the dependency graph
  const graphData = useMemo(() => {
    // For extension point mode, if no extension points are selected, default to all available extension points
    const effectiveSelectedExtensionPoints =
      visualizationMode === 'extensionpoint' && (!selectedExtensionPoints || selectedExtensionPoints.length === 0)
        ? availableExtensionPoints
        : selectedExtensionPoints || [];

    const options = {
      ...getDefaultOptions(),
      visualizationMode,
      showDependencyTypes: true,
      showDescriptions: false,
      selectedContentProviders,
      selectedContentConsumers,
      selectedExtensionPoints: effectiveSelectedExtensionPoints,
      linkExtensionColor: '#37872d',
      componentExtensionColor: '#ff9900',
      functionExtensionColor: '#e02f44',
    };
    const data = processPluginDataToGraph(options);
    logGraphData(data);
    return data;
  }, [
    visualizationMode,
    selectedContentProviders,
    selectedContentConsumers,
    selectedExtensionPoints,
    availableExtensionPoints,
  ]);

  return {
    graphData,
    availableProviders,
    availableConsumers,
    availableExtensionPoints,
    activeConsumers,
    contentProviderOptions,
    contentConsumerOptions,
    extensionPointOptions,
    selectedProviderValues,
    selectedConsumerValues,
    selectedExtensionPointValues,
  };
}
