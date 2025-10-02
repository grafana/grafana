import { VisualizationMode } from './useDependencyGraphData';
import { t } from '@grafana/i18n';
import { useState } from 'react';

export interface DependencyGraphControls {
  visualizationMode: VisualizationMode;
  selectedContentProviders: string[];
  selectedContentConsumers: string[];
  setVisualizationMode: (mode: VisualizationMode) => void;
  setSelectedContentProviders: (providers: string[]) => void;
  setSelectedContentConsumers: (consumers: string[]) => void;
  modeOptions: Array<{ label: string; value: VisualizationMode }>;
}

/**
 * Custom hook for managing dependency graph control state
 */
export function useDependencyGraphControls(): DependencyGraphControls {
  const [visualizationMode, setVisualizationMode] = useState<VisualizationMode>('add');
  const [selectedContentProviders, setSelectedContentProviders] = useState<string[]>([]);
  const [selectedContentConsumers, setSelectedContentConsumers] = useState<string[]>([]);

  const modeOptions = [
    { label: t('extensions.api-mode.add', 'Add'), value: 'add' as const },
    { label: t('extensions.api-mode.expose', 'Expose'), value: 'expose' as const },
  ];

  return {
    visualizationMode,
    selectedContentProviders,
    selectedContentConsumers,
    setVisualizationMode,
    setSelectedContentProviders,
    setSelectedContentConsumers,
    modeOptions,
  };
}
