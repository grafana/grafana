import React from 'react';

import { PanelPlugin, StandardEditorProps } from '@grafana/data';
import { t } from '@grafana/i18n';
import { MultiSelect } from '@grafana/ui';

import { PluginDependencyGraphPanel } from './components/PluginDependencyGraphPanel';
import { PanelOptions } from './types';
import {
  getActiveContentConsumers,
  getAvailableContentConsumers,
  getAvailableContentProviders,
} from './utils/dataProcessor';

// Custom multiselect editor for content providers
const ContentProviderMultiSelect: React.FC<StandardEditorProps<string[]>> = ({ value, onChange, context }) => {
  // Get visualization mode from panel options
  const visualizationMode = context.options?.visualizationMode || 'add';
  const availableProviders = getAvailableContentProviders(visualizationMode);

  const options = availableProviders.map((provider) => ({
    label: provider,
    value: provider,
  }));

  // If no value is set (empty array) or value is not defined, default to all providers selected
  const selectedValues = !value || value.length === 0 ? availableProviders : value;

  return (
    <MultiSelect
      options={options}
      value={selectedValues}
      onChange={(selected) => {
        // Extract values from SelectableValue objects
        const selectedValues = selected.map((item) => item.value).filter((value): value is string => Boolean(value));
        // If all providers are selected, store empty array to indicate "show all"
        const newValue = selectedValues.length === availableProviders.length ? [] : selectedValues;
        onChange(newValue);
      }}
      placeholder={t('extensions.dependency-graph.select-content-providers', 'Select content providers to display')}
    />
  );
};

// Custom multiselect editor for content consumers
const ContentConsumerMultiSelect: React.FC<StandardEditorProps<string[]>> = ({ value, onChange, context }) => {
  // Get visualization mode from panel options
  const visualizationMode = context.options?.visualizationMode || 'add';
  const availableConsumers = getAvailableContentConsumers(visualizationMode);
  const activeConsumers = getActiveContentConsumers(visualizationMode);

  const options = availableConsumers.map((consumer) => ({
    label: consumer === 'grafana-core' ? 'Grafana Core' : consumer,
    value: consumer,
  }));

  // If no value is set (empty array) or value is not defined, default to active consumers (those with providers)
  const selectedValues = !value || value.length === 0 ? activeConsumers : value;

  return (
    <MultiSelect
      options={options}
      value={selectedValues}
      onChange={(selected) => {
        // Extract values from SelectableValue objects
        const selectedValues = selected.map((item) => item.value).filter((value): value is string => Boolean(value));
        // If active consumers are selected (default state), store empty array to indicate default behavior
        const isDefaultSelection =
          selectedValues.length === activeConsumers.length &&
          activeConsumers.every((consumer) => selectedValues.includes(consumer));
        const newValue = isDefaultSelection ? [] : selectedValues;
        onChange(newValue);
      }}
      placeholder={t(
        'extensions.dependency-graph.select-content-consumers',
        'Select content consumers to display (active consumers by default)'
      )}
    />
  );
};

export const plugin = new PanelPlugin<PanelOptions>(PluginDependencyGraphPanel).setPanelOptions((builder) => {
  return (
    builder
      .addSelect({
        path: 'visualizationMode',
        name: t('extensions.dependency-graph.visualization-mode', 'Visualization Mode'),
        description: t(
          'extensions.dependency-graph.visualization-mode-description',
          'Choose between Add mode (plugins adding to extension points) or Expose mode (plugins exposing components)'
        ),
        defaultValue: 'add',
        settings: {
          options: [
            { label: t('extensions.dependency-graph.add-mode', 'Add Mode (Extensions)'), value: 'add' },
            { label: t('extensions.dependency-graph.expose-mode', 'Expose Mode (Components)'), value: 'expose' },
          ],
        },
      })

      .addBooleanSwitch({
        path: 'showDependencyTypes',
        name: t('extensions.dependency-graph.show-dependency-types', 'Show Dependency Types'),
        description: t(
          'extensions.dependency-graph.show-dependency-types-description',
          'Display the type of dependency on links'
        ),
        defaultValue: true,
      })
      .addBooleanSwitch({
        path: 'showDescriptions',
        name: t('extensions.dependency-graph.show-descriptions', 'Show Descriptions'),
        description: t(
          'extensions.dependency-graph.show-descriptions-description',
          'Display descriptions underneath extension points and exposed components'
        ),
        defaultValue: false,
      })

      // Color options
      .addColorPicker({
        path: 'linkExtensionColor',
        name: t('extensions.dependency-graph.link-extension-color', 'Link Extension Color'),
        description: t(
          'extensions.dependency-graph.link-extension-color-description',
          'Color for link extension points'
        ),
        defaultValue: '#37872d',
        category: ['Color Options'],
      })
      .addColorPicker({
        path: 'componentExtensionColor',
        name: t('extensions.dependency-graph.component-extension-color', 'Component Extension Color'),
        description: t(
          'extensions.dependency-graph.component-extension-color-description',
          'Color for component extension points'
        ),
        defaultValue: '#ff9900',
        category: ['Color Options'],
      })
      .addColorPicker({
        path: 'functionExtensionColor',
        name: t('extensions.dependency-graph.function-extension-color', 'Function Extension Color'),
        description: t(
          'extensions.dependency-graph.function-extension-color-description',
          'Color for function extension points (addedFunctions)'
        ),
        defaultValue: '#e02f44',
        category: ['Color Options'],
      })

      // Filtering options
      .addCustomEditor({
        id: 'contentProviderFilter',
        path: 'selectedContentProviders',
        name: t('extensions.dependency-graph.content-providers', 'Content Providers'),
        description: t(
          'extensions.dependency-graph.content-providers-description',
          'Add Mode: plugins that add to extension points | Expose Mode: plugins that expose components (left side)'
        ),
        editor: ContentProviderMultiSelect,
        category: ['Filtering'],
      })
      .addCustomEditor({
        id: 'contentConsumerFilter',
        path: 'selectedContentConsumers',
        name: t('extensions.dependency-graph.content-consumers', 'Content Consumers'),
        description: t(
          'extensions.dependency-graph.content-consumers-description',
          'Add Mode: plugins that define extension points | Expose Mode: plugins that consume exposed components (right side)'
        ),
        editor: ContentConsumerMultiSelect,
        category: ['Filtering'],
      })
  );
});
