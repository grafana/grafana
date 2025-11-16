import { InlineFieldRow } from '@grafana/ui';

import { DependencyGraphControls } from '../hooks/useDependencyGraphControls';
import { useDependencyGraphData } from '../hooks/useDependencyGraphData';

import { ContentConsumerSelector } from './controls/ContentConsumerSelector';
import { ContentProviderSelector } from './controls/ContentProviderSelector';
import { ExtensionPointSelector } from './controls/ExtensionPointSelector';
import { VisualizationModeSelector } from './controls/VisualizationModeSelector';

interface DependencyGraphControlsProps {
  controls: DependencyGraphControls;
}

/**
 * Reusable component for dependency graph controls (View, Content Provider, Content Consumer)
 */
export function DependencyGraphControlsComponent({ controls }: DependencyGraphControlsProps): JSX.Element {
  const {
    visualizationMode,
    selectedContentProviders,
    selectedContentConsumers,
    selectedContentConsumersForExtensionPoint,
    selectedExtensionPoints,
    selectedExtensions,
    setSelectedContentProviders,
    setSelectedContentConsumers,
    setSelectedContentConsumersForExtensionPoint,
    setSelectedExtensionPoints,
  } = controls;

  const {
    availableProviders,
    activeConsumers,
    extensionPointOptions,
    selectedProviderValues,
    selectedConsumerValues,
    selectedConsumerForExtensionPointValues,
    selectedExtensionPointValues,
  } = useDependencyGraphData({
    visualizationMode,
    selectedContentProviders,
    selectedContentConsumers,
    selectedContentConsumersForExtensionPoint,
    selectedExtensionPoints,
    selectedExtensions,
  });

  return (
    <>
      <InlineFieldRow>
        <VisualizationModeSelector controls={controls} />
        {visualizationMode !== 'extensionpoint' && (
          <>
            <ContentProviderSelector
              availableProviders={availableProviders}
              selectedProviderValues={selectedProviderValues}
              onProviderChange={(selected) => {
                const selectedValues = selected.map((item) => item.value).filter((v): v is string => Boolean(v));
                setSelectedContentProviders(selectedValues);
              }}
            />
            <ContentConsumerSelector
              activeConsumers={activeConsumers}
              selectedConsumerValues={selectedConsumerValues}
              onConsumerChange={(selected) => {
                const selectedValues = selected.map((item) => item.value).filter((v): v is string => Boolean(v));
                setSelectedContentConsumers(selectedValues);
              }}
            />
          </>
        )}
        {visualizationMode === 'extensionpoint' && (
          <>
            <ContentProviderSelector
              availableProviders={availableProviders}
              selectedProviderValues={selectedProviderValues}
              onProviderChange={(selected) => {
                const selectedValues = selected.map((item) => item.value).filter((v): v is string => Boolean(v));
                setSelectedContentProviders(selectedValues);
              }}
            />
            <ContentConsumerSelector
              activeConsumers={activeConsumers}
              selectedConsumerValues={selectedConsumerForExtensionPointValues}
              onConsumerChange={(selected) => {
                const selectedValues = selected.map((item) => item.value).filter((v): v is string => Boolean(v));
                setSelectedContentConsumersForExtensionPoint(selectedValues);
              }}
            />
            <ExtensionPointSelector
              extensionPointOptions={extensionPointOptions}
              selectedExtensionPointValues={selectedExtensionPointValues}
              onExtensionPointChange={(selected) => {
                const selectedValues = selected.map((item) => item.value).filter((v): v is string => Boolean(v));
                setSelectedExtensionPoints(selectedValues);
              }}
            />
          </>
        )}
      </InlineFieldRow>
    </>
  );
}
