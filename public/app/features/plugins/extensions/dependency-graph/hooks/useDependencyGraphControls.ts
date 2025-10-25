import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom-v5-compat';

import { t } from '@grafana/i18n';

import { VisualizationMode } from './useDependencyGraphData';

/**
 * Type guard to check if a string is a valid VisualizationMode
 */
const isValidVisualizationMode = (mode: string | null): mode is VisualizationMode => {
  return (
    mode === 'exposedComponents' ||
    mode === 'extensionpoint' ||
    mode === 'addedlinks' ||
    mode === 'addedcomponents' ||
    mode === 'addedfunctions'
  );
};

export interface DependencyGraphControls {
  visualizationMode: VisualizationMode;
  selectedContentProviders: string[];
  selectedContentConsumers: string[];
  selectedContentConsumersForExtensionPoint: string[];
  selectedExtensionPoints: string[];
  selectedExtensions: string[];
  setVisualizationMode: (mode: VisualizationMode) => void;
  setSelectedContentProviders: (providers: string[]) => void;
  setSelectedContentConsumers: (consumers: string[]) => void;
  setSelectedContentConsumersForExtensionPoint: (consumers: string[]) => void;
  setSelectedExtensionPoints: (extensionPoints: string[]) => void;
  setSelectedExtensions: (extensions: string[]) => void;
  modeOptions: Array<{ label: string; value: VisualizationMode }>;
}

/**
 * URL parameter utilities for dependency graph controls
 */
const URL_PARAMS = {
  API_MODE: 'view',
  CONTENT_PROVIDERS: 'contentProviders',
  CONTENT_CONSUMERS: 'contentConsumers',
  CONTENT_CONSUMERS_FOR_EXTENSION_POINT: 'contentConsumersForExtensionPoint',
  EXTENSION_POINTS: 'extensionPoints',
  EXTENSIONS: 'extensions',
} as const;

/**
 * Parse comma-separated string to array
 */
const parseArrayParam = (value: string | null): string[] => {
  if (!value) {
    return [];
  }
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
    const mode = searchParams.get(URL_PARAMS.API_MODE);
    return isValidVisualizationMode(mode) ? mode : 'addedlinks';
  });

  const [selectedContentProviders, setSelectedContentProvidersState] = useState<string[]>(() => {
    return parseArrayParam(searchParams.get(URL_PARAMS.CONTENT_PROVIDERS));
  });

  const [selectedContentConsumers, setSelectedContentConsumersState] = useState<string[]>(() => {
    return parseArrayParam(searchParams.get(URL_PARAMS.CONTENT_CONSUMERS));
  });

  const [selectedContentConsumersForExtensionPoint, setSelectedContentConsumersForExtensionPointState] = useState<
    string[]
  >(() => {
    return parseArrayParam(searchParams.get(URL_PARAMS.CONTENT_CONSUMERS_FOR_EXTENSION_POINT));
  });

  const [selectedExtensionPoints, setSelectedExtensionPointsState] = useState<string[]>(() => {
    return parseArrayParam(searchParams.get(URL_PARAMS.EXTENSION_POINTS));
  });

  const [selectedExtensions, setSelectedExtensionsState] = useState<string[]>(() => {
    return parseArrayParam(searchParams.get(URL_PARAMS.EXTENSIONS));
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
      // Reset filters when changing views via dropdown
      setSelectedContentProvidersState([]);
      setSelectedContentConsumersState([]);
      setSelectedContentConsumersForExtensionPointState([]);
      setSelectedExtensionPointsState([]);
      setSelectedExtensionsState([]);
      updateUrlParams({
        [URL_PARAMS.API_MODE]: mode,
        [URL_PARAMS.CONTENT_PROVIDERS]: null,
        [URL_PARAMS.CONTENT_CONSUMERS]: null,
        [URL_PARAMS.CONTENT_CONSUMERS_FOR_EXTENSION_POINT]: null,
        [URL_PARAMS.EXTENSION_POINTS]: null,
        [URL_PARAMS.EXTENSIONS]: null,
      });
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

  const setSelectedContentConsumersForExtensionPoint = useCallback(
    (consumers: string[]) => {
      setSelectedContentConsumersForExtensionPointState(consumers);
      updateUrlParams({
        [URL_PARAMS.CONTENT_CONSUMERS_FOR_EXTENSION_POINT]:
          consumers.length > 0 ? serializeArrayParam(consumers) : null,
      });
    },
    [updateUrlParams]
  );

  const setSelectedExtensionPoints = useCallback(
    (extensionPoints: string[]) => {
      setSelectedExtensionPointsState(extensionPoints);
      updateUrlParams({
        [URL_PARAMS.EXTENSION_POINTS]: extensionPoints.length > 0 ? serializeArrayParam(extensionPoints) : null,
      });
    },
    [updateUrlParams]
  );

  const setSelectedExtensions = useCallback(
    (extensions: string[]) => {
      setSelectedExtensionsState(extensions);
      updateUrlParams({
        [URL_PARAMS.EXTENSIONS]: extensions.length > 0 ? serializeArrayParam(extensions) : null,
      });
    },
    [updateUrlParams]
  );

  // Sync state with URL parameters when they change externally
  useEffect(() => {
    const mode = searchParams.get(URL_PARAMS.API_MODE);
    if (isValidVisualizationMode(mode)) {
      setVisualizationModeState(mode);
    } else {
      // Default to 'addedlinks' mode when no view parameter is present
      setVisualizationModeState('addedlinks');
    }

    const providers = parseArrayParam(searchParams.get(URL_PARAMS.CONTENT_PROVIDERS));
    setSelectedContentProvidersState(providers);

    const consumers = parseArrayParam(searchParams.get(URL_PARAMS.CONTENT_CONSUMERS));
    setSelectedContentConsumersState(consumers);

    const consumersForExtensionPoint = parseArrayParam(
      searchParams.get(URL_PARAMS.CONTENT_CONSUMERS_FOR_EXTENSION_POINT)
    );
    setSelectedContentConsumersForExtensionPointState(consumersForExtensionPoint);

    const extensionPoints = parseArrayParam(searchParams.get(URL_PARAMS.EXTENSION_POINTS));
    setSelectedExtensionPointsState(extensionPoints);

    const extensions = parseArrayParam(searchParams.get(URL_PARAMS.EXTENSIONS));
    setSelectedExtensionsState(extensions);
  }, [searchParams]);

  const modeOptions = [
    { label: t('extensions.view.addedlinks', 'Added links'), value: 'addedlinks' as const },
    { label: t('extensions.view.addedcomponents', 'Added components'), value: 'addedcomponents' as const },
    { label: t('extensions.view.addedfunctions', 'Added functions'), value: 'addedfunctions' as const },
    { label: t('extensions.view.exposedComponents', 'Exposed components'), value: 'exposedComponents' as const },
    { label: t('extensions.view.extensionpoints', 'Extension points'), value: 'extensionpoint' as const },
  ];

  return {
    visualizationMode,
    selectedContentProviders,
    selectedContentConsumers,
    selectedContentConsumersForExtensionPoint,
    selectedExtensionPoints,
    selectedExtensions,
    setVisualizationMode,
    setSelectedContentProviders,
    setSelectedContentConsumers,
    setSelectedContentConsumersForExtensionPoint,
    setSelectedExtensionPoints,
    setSelectedExtensions,
    modeOptions,
  };
}
