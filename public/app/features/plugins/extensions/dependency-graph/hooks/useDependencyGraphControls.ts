import { useCallback, useEffect, useState } from 'react';

import { VisualizationMode } from './useDependencyGraphData';
import { t } from '@grafana/i18n';
import { useSearchParams } from 'react-router-dom-v5-compat';

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
 * URL parameter utilities for dependency graph controls
 */
const URL_PARAMS = {
  API_MODE: 'apiMode',
  CONTENT_PROVIDERS: 'contentProviders',
  CONTENT_CONSUMERS: 'contentConsumers',
} as const;

/**
 * Parse comma-separated string to array
 */
const parseArrayParam = (value: string | null): string[] => {
  if (!value) return [];
  return value.split(',').filter(Boolean);
};

/**
 * Serialize array to comma-separated string
 */
const serializeArrayParam = (array: string[]): string => {
  return array.join(',');
};

/**
 * Custom hook for managing dependency graph control state with URL synchronization
 */
export function useDependencyGraphControls(): DependencyGraphControls {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL parameters
  const [visualizationMode, setVisualizationModeState] = useState<VisualizationMode>(() => {
    const mode = searchParams.get(URL_PARAMS.API_MODE) as VisualizationMode;
    return mode === 'add' || mode === 'expose' ? mode : 'add';
  });

  const [selectedContentProviders, setSelectedContentProvidersState] = useState<string[]>(() => {
    return parseArrayParam(searchParams.get(URL_PARAMS.CONTENT_PROVIDERS));
  });

  const [selectedContentConsumers, setSelectedContentConsumersState] = useState<string[]>(() => {
    return parseArrayParam(searchParams.get(URL_PARAMS.CONTENT_CONSUMERS));
  });

  // Update URL parameters when state changes
  const updateUrlParams = useCallback(
    (updates: Record<string, string | null>) => {
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        Object.entries(updates).forEach(([key, value]) => {
          if (value === null || value === '') {
            newParams.delete(key);
          } else {
            newParams.set(key, value);
          }
        });
        return newParams;
      });
    },
    [setSearchParams]
  );

  // Wrapper functions that update both state and URL
  const setVisualizationMode = useCallback(
    (mode: VisualizationMode) => {
      setVisualizationModeState(mode);
      updateUrlParams({ [URL_PARAMS.API_MODE]: mode });
    },
    [updateUrlParams]
  );

  const setSelectedContentProviders = useCallback(
    (providers: string[]) => {
      setSelectedContentProvidersState(providers);
      updateUrlParams({
        [URL_PARAMS.CONTENT_PROVIDERS]: providers.length > 0 ? serializeArrayParam(providers) : null,
      });
    },
    [updateUrlParams]
  );

  const setSelectedContentConsumers = useCallback(
    (consumers: string[]) => {
      setSelectedContentConsumersState(consumers);
      updateUrlParams({
        [URL_PARAMS.CONTENT_CONSUMERS]: consumers.length > 0 ? serializeArrayParam(consumers) : null,
      });
    },
    [updateUrlParams]
  );

  // Sync state with URL parameters when they change externally
  useEffect(() => {
    const mode = searchParams.get(URL_PARAMS.API_MODE) as VisualizationMode;
    if (mode === 'add' || mode === 'expose') {
      setVisualizationModeState(mode);
    }

    const providers = parseArrayParam(searchParams.get(URL_PARAMS.CONTENT_PROVIDERS));
    setSelectedContentProvidersState(providers);

    const consumers = parseArrayParam(searchParams.get(URL_PARAMS.CONTENT_CONSUMERS));
    setSelectedContentConsumersState(consumers);
  }, [searchParams]);

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
