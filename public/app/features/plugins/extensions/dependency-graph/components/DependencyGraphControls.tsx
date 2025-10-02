import { InlineField, InlineFieldRow, MultiCombobox, Select } from '@grafana/ui';
import React, { useCallback } from 'react';

import { DependencyGraphControls } from '../hooks/useDependencyGraphControls';
import { t } from '@grafana/i18n';
import { useDependencyGraphData } from '../hooks/useDependencyGraphData';

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
    setVisualizationMode,
    setSelectedContentProviders,
    setSelectedContentConsumers,
    modeOptions,
  } = controls;

  const {
    availableProviders,
    availableConsumers,
    activeConsumers,
    contentProviderOptions,
    contentConsumerOptions,
    selectedProviderValues,
    selectedConsumerValues,
  } = useDependencyGraphData({
    visualizationMode,
    selectedContentProviders,
    selectedContentConsumers,
  });

  const handleModeChange = useCallback(
    (option: { value?: 'add' | 'expose' }) => {
      if (option.value === 'add' || option.value === 'expose') {
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

  return (
    <InlineFieldRow>
      <InlineField label={t('extensions.api-mode.label', 'API Mode')}>
        <Select options={modeOptions} value={visualizationMode} onChange={handleModeChange} width={12} />
      </InlineField>
      <InlineField label={t('extensions.content-provider.label', 'Content provider')}>
        <MultiCombobox
          options={contentProviderOptions}
          value={selectedProviderValues}
          onChange={handleProviderChange}
          placeholder={t('extensions.content-provider.placeholder', 'Select content providers to display')}
          width="auto"
          minWidth={100}
          maxWidth={100}
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
          minWidth={100}
          maxWidth={100}
        />
      </InlineField>
    </InlineFieldRow>
  );
}
