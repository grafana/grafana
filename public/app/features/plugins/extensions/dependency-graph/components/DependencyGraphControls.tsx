import { useCallback } from 'react';

import { t } from '@grafana/i18n';
import { Combobox, InlineField, InlineFieldRow, MultiCombobox } from '@grafana/ui';

import { DependencyGraphControls } from '../hooks/useDependencyGraphControls';
import { VisualizationMode, useDependencyGraphData } from '../hooks/useDependencyGraphData';

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
    selectedExtensionPoints,
    selectedExtensions,
    setVisualizationMode,
    setSelectedContentProviders,
    setSelectedContentConsumers,
    setSelectedExtensionPoints,
    modeOptions,
  } = controls;

  const {
    availableProviders,
    activeConsumers,
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
    selectedExtensions,
  });

  const handleModeChange = useCallback(
    (option: { value?: VisualizationMode }) => {
      if (
        option.value &&
        (option.value === 'add' ||
          option.value === 'expose' ||
          option.value === 'addedlinks' ||
          option.value === 'extensionpoint')
      ) {
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
      const newValue = selectedValues.length === extensionPointOptions.length ? [] : selectedValues;
      setSelectedExtensionPoints(newValue);
    },
    [extensionPointOptions.length, setSelectedExtensionPoints]
  );

  return (
    <>
      <InlineFieldRow>
        <InlineField label={t('extensions.view.label', 'View')}>
          <Combobox<VisualizationMode>
            options={modeOptions}
            value={visualizationMode}
            onChange={handleModeChange}
            width="auto"
            minWidth={12}
          />
        </InlineField>
        {visualizationMode !== 'extensionpoint' && (
          <>
            <InlineField label={t('extensions.content-provider.label', 'Content provider')}>
              <MultiCombobox
                options={contentProviderOptions}
                value={selectedProviderValues}
                onChange={handleProviderChange}
                placeholder={t('extensions.content-provider.placeholder', 'Select content providers to display')}
                width="auto"
                enableAllOption
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
                enableAllOption
                minWidth={20}
                maxWidth={30}
              />
            </InlineField>
          </>
        )}
        {visualizationMode === 'extensionpoint' && (
          <>
            <InlineField label={t('extensions.content-provider.label', 'Content provider')}>
              <MultiCombobox
                options={contentProviderOptions}
                value={selectedProviderValues}
                onChange={handleProviderChange}
                placeholder={t('extensions.content-provider.placeholder', 'Select content providers to display')}
                width="auto"
                enableAllOption
                minWidth={20}
                maxWidth={30}
              />
            </InlineField>
            <InlineField label={t('extensions.extension-points.label', 'Extension points')}>
              <MultiCombobox
                options={extensionPointOptions}
                value={selectedExtensionPointValues}
                onChange={handleExtensionPointChange}
                placeholder={t('extensions.extension-points.placeholder', 'Select extension points to display')}
                width="auto"
                enableAllOption
                minWidth={20}
                maxWidth={30}
              />
            </InlineField>
          </>
        )}
      </InlineFieldRow>
    </>
  );
}
