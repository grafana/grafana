import { InlineField, InlineFieldRow, MultiCombobox, Select } from '@grafana/ui';
import { VisualizationMode, useDependencyGraphData } from '../hooks/useDependencyGraphData';

import { DependencyGraphControls } from '../hooks/useDependencyGraphControls';
import { t } from '@grafana/i18n';
import { useCallback } from 'react';

interface DependencyGraphControlsProps {
  controls: DependencyGraphControls;
}

/**
 * Reusable component for dependency graph controls (API Mode, Content Provider, Content Consumer)
 */
export function DependencyGraphControlsComponent({ controls }: DependencyGraphControlsProps): JSX.Element {
  const {
    visualizationMode,
    selectedContentProviders,
    selectedContentConsumers,
    selectedExtensionPoints,
    setVisualizationMode,
    setSelectedContentProviders,
    setSelectedContentConsumers,
    setSelectedExtensionPoints,
    modeOptions,
  } = controls;

  const {
    availableProviders,
    activeConsumers,
    availableExtensionPoints,
    contentProviderOptions,
    contentConsumerOptions,
    extensionPointOptions,
    selectedProviderValues,
    selectedConsumerValues,
    selectedExtensionPointValues,
  } = useDependencyGraphData({
    visualizationMode,
    selectedContentProviders,
    selectedContentConsumers,
    selectedExtensionPoints,
  });

  const handleModeChange = useCallback(
    (option: { value?: VisualizationMode }) => {
      if (option.value && (option.value === 'add' || option.value === 'expose' || option.value === 'extensionpoint')) {
        setVisualizationMode(option.value);
      }
    },
    [setVisualizationMode]
  );

  const handleProviderChange = useCallback(
    (selected: Array<{ value?: string }>) => {
      const selectedValues = selected.map((item) => item.value).filter((v): v is string => Boolean(v));
      const newValue = selectedValues.length === availableProviders.length ? [] : selectedValues;
      setSelectedContentProviders(newValue);
    },
    [availableProviders.length, setSelectedContentProviders]
  );

  const handleConsumerChange = useCallback(
    (selected: Array<{ value?: string }>) => {
      const selectedValues = selected.map((item) => item.value).filter((v): v is string => Boolean(v));
      const isDefaultSelection =
        selectedValues.length === activeConsumers.length &&
        activeConsumers.every((consumer) => selectedValues.includes(consumer));
      const newValue = isDefaultSelection ? [] : selectedValues;
      setSelectedContentConsumers(newValue);
    },
    [activeConsumers, setSelectedContentConsumers]
  );

  const handleExtensionPointChange = useCallback(
    (selected: Array<{ value?: string }>) => {
      const selectedValues = selected.map((item) => item.value).filter((v): v is string => Boolean(v));
      const newValue = selectedValues.length === availableExtensionPoints.length ? [] : selectedValues;
      setSelectedExtensionPoints(newValue);
    },
    [availableExtensionPoints.length, setSelectedExtensionPoints]
  );

  return (
    <InlineFieldRow>
      <InlineField label={t('extensions.api-mode.label', 'API Mode')}>
        <Select<VisualizationMode>
          options={modeOptions}
          value={visualizationMode}
          onChange={handleModeChange}
          width={12}
        />
      </InlineField>
      {visualizationMode === 'extensionpoint' ? (
        <InlineField label={t('extensions.extension-points.label', 'Extension Points')}>
          <MultiCombobox
            options={extensionPointOptions}
            value={selectedExtensionPointValues}
            onChange={handleExtensionPointChange}
            placeholder={t('extensions.extension-points.placeholder', 'Select extension points to display')}
            width="auto"
            minWidth={20}
            maxWidth={30}
          />
        </InlineField>
      ) : (
        <>
          <InlineField label={t('extensions.content-provider.label', 'Content provider')}>
            <MultiCombobox
              options={contentProviderOptions}
              value={selectedProviderValues}
              onChange={handleProviderChange}
              placeholder={t('extensions.content-provider.placeholder', 'Select content providers to display')}
              width="auto"
              minWidth={20}
              maxWidth={30}
            />
          </InlineField>
          <InlineField label={t('extensions.content-consumer.label', 'Content consumer')}>
            <MultiCombobox
              options={contentConsumerOptions}
              value={selectedConsumerValues}
              onChange={handleConsumerChange}
              placeholder={t(
                'extensions.content-consumer.placeholder',
                'Select content consumers to display (active consumers by default)'
              )}
              width="auto"
              minWidth={20}
              maxWidth={30}
            />
          </InlineField>
        </>
      )}
    </InlineFieldRow>
  );
}
