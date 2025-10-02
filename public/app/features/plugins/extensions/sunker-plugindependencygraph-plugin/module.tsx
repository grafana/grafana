import React from 'react';

import { PanelPlugin, StandardEditorProps } from '@grafana/data';
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
        const selectedValues = selected.map((item) => item.value).filter(Boolean) as string[];
        // If all providers are selected, store empty array to indicate "show all"
        const newValue = selectedValues.length === availableProviders.length ? [] : selectedValues;
        onChange(newValue);
      }}
      placeholder="Select content providers to display"
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
        const selectedValues = selected.map((item) => item.value).filter(Boolean) as string[];
        // If active consumers are selected (default state), store empty array to indicate default behavior
        const isDefaultSelection =
          selectedValues.length === activeConsumers.length &&
          activeConsumers.every((consumer) => selectedValues.includes(consumer));
        const newValue = isDefaultSelection ? [] : selectedValues;
        onChange(newValue);
      }}
      placeholder="Select content consumers to display (active consumers by default)"
    />
  );
};

export const plugin = new PanelPlugin<PanelOptions>(PluginDependencyGraphPanel).setPanelOptions((builder) => {
  return (
    builder
      .addSelect({
        path: 'visualizationMode',
        name: 'Visualization Mode',
        description:
          'Choose between Add mode (plugins adding to extension points) or Expose mode (plugins exposing components)',
        defaultValue: 'add',
        settings: {
          options: [
            { label: 'Add Mode (Extensions)', value: 'add' },
            { label: 'Expose Mode (Components)', value: 'expose' },
          ],
        },
      })

      .addBooleanSwitch({
        path: 'showDependencyTypes',
        name: 'Show Dependency Types',
        description: 'Display the type of dependency on links',
        defaultValue: true,
      })
      .addBooleanSwitch({
        path: 'showDescriptions',
        name: 'Show Descriptions',
        description: 'Display descriptions underneath extension points and exposed components',
        defaultValue: false,
      })

      // Color options
      .addColorPicker({
        path: 'linkExtensionColor',
        name: 'Link Extension Color',
        description: 'Color for link extension points',
        defaultValue: '#37872d',
        category: ['Color Options'],
      })
      .addColorPicker({
        path: 'componentExtensionColor',
        name: 'Component Extension Color',
        description: 'Color for component extension points',
        defaultValue: '#ff9900',
        category: ['Color Options'],
      })
      .addColorPicker({
        path: 'functionExtensionColor',
        name: 'Function Extension Color',
        description: 'Color for function extension points (addedFunctions)',
        defaultValue: '#e02f44',
        category: ['Color Options'],
      })

      // Filtering options
      .addCustomEditor({
        id: 'contentProviderFilter',
        path: 'selectedContentProviders',
        name: 'Content Providers',
        description:
          'Add Mode: plugins that add to extension points | Expose Mode: plugins that expose components (left side)',
        editor: ContentProviderMultiSelect,
        category: ['Filtering'],
      })
      .addCustomEditor({
        id: 'contentConsumerFilter',
        path: 'selectedContentConsumers',
        name: 'Content Consumers',
        description:
          'Add Mode: plugins that define extension points | Expose Mode: plugins that consume exposed components (right side)',
        editor: ContentConsumerMultiSelect,
        category: ['Filtering'],
      })
  );
});
