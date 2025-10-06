import { useCallback } from 'react';

import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Button, InlineField, InlineFieldRow, MultiCombobox, Select } from '@grafana/ui';

import { DependencyGraphControls } from '../hooks/useDependencyGraphControls';
import { VisualizationMode, useDependencyGraphData } from '../hooks/useDependencyGraphData';

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
    (option: { value?: VisualizationMode }) => {
      if (option.value && (option.value === 'add' || option.value === 'expose')) {
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
    <>
      <InlineFieldRow>
        {visualizationMode !== 'extensionpoint' && (
          <InlineField label={t('extensions.api-mode.label', 'API Mode')}>
            <Select<VisualizationMode>
              options={modeOptions}
              value={visualizationMode}
              onChange={handleModeChange}
              width={12}
            />
          </InlineField>
        )}
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
      </InlineFieldRow>

      {/* Back button for extension point mode */}
      {visualizationMode === 'extensionpoint' && (
        <Button
          variant="secondary"
          size="sm"
          icon="arrow-left"
          onClick={() => {
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.delete('apiMode');
            currentUrl.searchParams.delete('extensionPoints');
            locationService.push(currentUrl.pathname + currentUrl.search);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <Trans i18nKey="extensions.back-to-add-api-mode">Back to Add API mode</Trans>
        </Button>
      )}
    </>
  );
}
