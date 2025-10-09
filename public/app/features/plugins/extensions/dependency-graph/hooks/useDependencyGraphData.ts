import { useMemo } from 'react';

import {
  getActiveContentConsumers,
  getAvailableContentConsumers,
  getAvailableContentProviders,
  getAvailableExtensionPoints,
  getAvailableExtensions,
} from '../dependency-graph-panel/utils/helpers/dataQueries';
import { getDefaultOptions } from '../dependency-graph-panel/utils/helpers/defaults';
import { processPluginDataToGraph } from '../dependency-graph-panel/utils/processors/mainProcessor';
import { logGraphData } from '../utils/logger';

export type VisualizationMode =
  | 'exposedComponents'
  | 'extensionpoint'
  | 'addedlinks'
  | 'addedcomponents'
  | 'addedfunctions';

export interface DependencyGraphOptions {
  visualizationMode: VisualizationMode;
  selectedContentProviders: string[];
  selectedContentConsumers: string[];
  selectedContentConsumersForExtensionPoint?: string[];
  selectedExtensionPoints?: string[];
  selectedExtensions?: string[];
}

export interface DependencyGraphData {
  graphData: ReturnType<typeof processPluginDataToGraph>;
  availableProviders: string[];
  availableConsumers: string[];
  availableExtensionPoints: string[];
  availableExtensions: string[];
  activeConsumers: string[];
  contentProviderOptions: Array<{ label: string; value: string }>;
  contentConsumerOptions: Array<{ label: string; value: string }>;
  contentConsumerForExtensionPointOptions: Array<{ label: string; value: string }>;
  extensionPointOptions: Array<{ label: string; value: string }>;
  extensionOptions: Array<{ label: string; value: string }>;
  selectedProviderValues: string[];
  selectedConsumerValues: string[];
  selectedConsumerForExtensionPointValues: string[];
  selectedExtensionPointValues: string[];
  selectedExtensionValues: string[];
}

/**
 * Custom hook for managing dependency graph data and options
 */
export function useDependencyGraphData({
  visualizationMode,
  selectedContentProviders,
  selectedContentConsumers,
  selectedContentConsumersForExtensionPoint,
  selectedExtensionPoints,
  selectedExtensions,
}: DependencyGraphOptions): DependencyGraphData {
  // Get available providers and consumers based on visualization mode
  const availableProviders = useMemo(() => getAvailableContentProviders(visualizationMode), [visualizationMode]);

  const availableConsumers = useMemo(() => getAvailableContentConsumers(visualizationMode), [visualizationMode]);

  const availableExtensionPoints = useMemo(() => getAvailableExtensionPoints(), []);

  const availableExtensions = useMemo(() => getAvailableExtensions(), []);

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

  const contentConsumerForExtensionPointOptions = useMemo(() => {
    const consumers = getAvailableContentConsumers('extensionpoint');
    return consumers.map((consumer) => ({
      label: consumer === 'grafana-core' ? 'Grafana Core' : consumer,
      value: consumer,
    }));
  }, []);

  const extensionPointOptions = useMemo(() => {
    // If content consumer filtering is enabled, only show extension points from selected consumers
    if (selectedContentConsumersForExtensionPoint && selectedContentConsumersForExtensionPoint.length > 0) {
      // Filter extension points to only include those from selected content consumers
      const filteredExtensionPoints = availableExtensionPoints.filter((extensionPoint) => {
        // Check if this extension point belongs to one of the selected content consumers
        return selectedContentConsumersForExtensionPoint.some((consumer) => {
          // For grafana-core extension points
          if (consumer === 'grafana-core' && extensionPoint.startsWith('grafana/')) {
            return true;
          }
          // For plugin extension points
          if (extensionPoint.startsWith(`${consumer}/`)) {
            return true;
          }
          return false;
        });
      });

      return filteredExtensionPoints.map((extensionPoint) => ({
        label: extensionPoint,
        value: extensionPoint,
      }));
    }

    // If no content consumer filtering, show all extension points
    return availableExtensionPoints.map((extensionPoint) => ({
      label: extensionPoint,
      value: extensionPoint,
    }));
  }, [availableExtensionPoints, selectedContentConsumersForExtensionPoint]);

  const extensionOptions = useMemo(
    () =>
      availableExtensions.map((extension) => ({
        label: extension,
        value: extension,
      })),
    [availableExtensions]
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

  const selectedConsumerForExtensionPointValues = useMemo(() => {
    const consumers = getAvailableContentConsumers('extensionpoint');
    return !selectedContentConsumersForExtensionPoint || selectedContentConsumersForExtensionPoint.length === 0
      ? consumers
      : selectedContentConsumersForExtensionPoint;
  }, [selectedContentConsumersForExtensionPoint]);

  const selectedExtensionPointValues = useMemo(() => {
    // Get the filtered extension points (same logic as extensionPointOptions)
    const filteredExtensionPoints = (() => {
      if (selectedContentConsumersForExtensionPoint && selectedContentConsumersForExtensionPoint.length > 0) {
        return availableExtensionPoints.filter((extensionPoint) => {
          return selectedContentConsumersForExtensionPoint.some((consumer) => {
            if (consumer === 'grafana-core' && extensionPoint.startsWith('grafana/')) {
              return true;
            }
            if (extensionPoint.startsWith(`${consumer}/`)) {
              return true;
            }
            return false;
          });
        });
      }
      return availableExtensionPoints;
    })();

    return !selectedExtensionPoints || selectedExtensionPoints.length === 0
      ? filteredExtensionPoints
      : selectedExtensionPoints;
  }, [selectedExtensionPoints, availableExtensionPoints, selectedContentConsumersForExtensionPoint]);

  const selectedExtensionValues = useMemo(
    () => (!selectedExtensions || selectedExtensions.length === 0 ? availableExtensions : selectedExtensions),
    [selectedExtensions, availableExtensions]
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
      selectedContentConsumersForExtensionPoint: selectedContentConsumersForExtensionPoint || [],
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
    selectedContentConsumersForExtensionPoint,
    selectedExtensionPoints,
    availableExtensionPoints,
  ]);

  return {
    graphData,
    availableProviders,
    availableConsumers,
    availableExtensionPoints,
    availableExtensions,
    activeConsumers,
    contentProviderOptions,
    contentConsumerOptions,
    contentConsumerForExtensionPointOptions,
    extensionPointOptions,
    extensionOptions,
    selectedProviderValues,
    selectedConsumerValues,
    selectedConsumerForExtensionPointValues,
    selectedExtensionPointValues,
    selectedExtensionValues,
  };
}
