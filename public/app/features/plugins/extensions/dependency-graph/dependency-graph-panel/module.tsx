/**
 * @packageDocumentation
 *
 * # Plugin Dependency Graph Panel
 *
 * A Grafana panel plugin that visualizes dependencies between Grafana plugins,
 * specifically focusing on extension relationships where one plugin extends another.
 *
 * ## Features
 *
 * - **Extension Relationship Visualization**: Displays provider-consumer relationships between plugins
 * - **Interactive Graph**: Drag nodes, multiple layout options (force-directed, hierarchical, circular)
 * - **Customizable Appearance**: Configure node sizes, colors, and labels
 * - **Real-time Data Processing**: Processes Grafana table data to create dependency graphs
 * - **Sample Data**: Includes sample data for testing when no data source is available
 *
 * ## Visualization Modes
 *
 * - **Exposed Components**: Shows components exposed by plugins and their consumers
 * - **Extension Points**: Shows extension points and the plugins that provide content to them
 * - **Added Links**: Shows navigation links added by plugins
 * - **Added Components**: Shows UI components added by plugins
 * - **Added Functions**: Shows functions added by plugins
 *
 * @public
 */

import { PanelPlugin, StandardEditorProps } from '@grafana/data';
import { t } from '@grafana/i18n';
import { MultiCombobox } from '@grafana/ui';

import { PluginDependencyGraphPanel } from './components/PluginDependencyGraphPanel';
import { PanelOptions } from './types';
import {
  getActiveContentConsumers,
  getAvailableContentConsumers,
  getAvailableContentProviders,
  getAvailableExtensionPoints,
} from './utils/helpers/dataQueries';

// Custom multiselect editor for content providers
function ContentProviderMultiSelect({ value, onChange, context }: StandardEditorProps<string[]>) {
  // Get visualization mode from panel options
  const visualizationMode = context.options?.visualizationMode || 'addedlinks';
  const availableProviders = getAvailableContentProviders(visualizationMode);

  const options = availableProviders.map((provider) => ({
    label: provider,
    value: provider,
  }));

  // If no value is set (empty array) or value is not defined, default to all providers selected
  const selectedValues = !value || value.length === 0 ? availableProviders : value;

  return (
    <MultiCombobox
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
}

// Custom multiselect editor for content consumers
function ContentConsumerMultiSelect({ value, onChange, context }: StandardEditorProps<string[]>) {
  // Get visualization mode from panel options
  const visualizationMode = context.options?.visualizationMode || 'addedlinks';
  const availableConsumers = getAvailableContentConsumers(visualizationMode);
  const activeConsumers = getActiveContentConsumers(visualizationMode);

  const options = availableConsumers.map((consumer) => ({
    label: consumer === 'grafana-core' ? 'Grafana Core' : consumer,
    value: consumer,
  }));

  // If no value is set (empty array) or value is not defined, default to active consumers (those with providers)
  const selectedValues = !value || value.length === 0 ? activeConsumers : value;

  return (
    <MultiCombobox
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
}

// Custom multiselect editor for content consumers in extension point mode
function ContentConsumerForExtensionPointMultiSelect({ value, onChange, context }: StandardEditorProps<string[]>) {
  console.log('ContentConsumerForExtensionPointMultiSelect component called');
  const availableContentConsumers = getAvailableContentConsumers('extensionpoint');

  // Debug logging
  console.log('ContentConsumerForExtensionPointMultiSelect rendered', {
    availableContentConsumers,
    value,
    context: context?.options?.visualizationMode,
  });

  const options = availableContentConsumers.map((consumer) => ({
    label: consumer === 'grafana-core' ? 'Grafana Core' : consumer,
    value: consumer,
  }));

  // Use the actual value, but show all options as selected when value is empty (meaning "show all")
  const selectedValues = value && value.length > 0 ? value : availableContentConsumers;

  return (
    <MultiCombobox
      options={options}
      value={selectedValues}
      onChange={(selected) => {
        // Extract values from SelectableValue objects
        const selectedValues = selected.map((item) => item.value).filter((value): value is string => Boolean(value));
        // If all content consumers are selected, store empty array to indicate "show all"
        const newValue = selectedValues.length === availableContentConsumers.length ? [] : selectedValues;
        onChange(newValue);
      }}
      placeholder={t(
        'extensions.dependency-graph.select-content-consumers-extension-point',
        'Select content consumers to display'
      )}
    />
  );
}

// Custom multiselect editor for extension points
function ExtensionPointMultiSelect({ value, onChange, context }: StandardEditorProps<string[]>) {
  const availableExtensionPoints = getAvailableExtensionPoints();

  const options = availableExtensionPoints.map((extensionPoint) => ({
    label: extensionPoint,
    value: extensionPoint,
  }));

  // If no value is set (empty array) or value is not defined, default to all extension points selected
  const selectedValues = !value || value.length === 0 ? availableExtensionPoints : value;

  return (
    <MultiCombobox
      options={options}
      value={selectedValues}
      onChange={(selected) => {
        // Extract values from SelectableValue objects
        const selectedValues = selected.map((item) => item.value).filter((value): value is string => Boolean(value));
        // If all extension points are selected, store empty array to indicate "show all"
        const newValue = selectedValues.length === availableExtensionPoints.length ? [] : selectedValues;
        onChange(newValue);
      }}
      placeholder={t('extensions.dependency-graph.select-extension-points', 'Select extension points to display')}
    />
  );
}

export const plugin = new PanelPlugin<PanelOptions>(PluginDependencyGraphPanel).setPanelOptions((builder) => {
  console.log('Panel options builder called');
  return (
    builder
      .addSelect({
        path: 'visualizationMode',
        name: t('extensions.dependency-graph.visualization-mode', 'Visualization Mode'),
        description: t(
          'extensions.dependency-graph.visualization-mode-description',
          'Choose between Add mode (plugins adding to extension points), Expose mode (plugins exposing components), or Extension Point mode (extensions and extension points)'
        ),
        defaultValue: 'addedlinks',
        settings: {
          options: [
            { label: t('extensions.dependency-graph.added-links-mode', 'Added Links Mode'), value: 'addedlinks' },
            {
              label: t('extensions.dependency-graph.exposed-components-mode', 'Exposed Components Mode'),
              value: 'exposedComponents',
            },
            {
              label: t('extensions.dependency-graph.extensionpoint-mode', 'Extension Point Mode'),
              value: 'extensionpoint',
            },
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
        showIf: (currentConfig: PanelOptions) => currentConfig.visualizationMode !== 'extensionpoint',
      })
      .addCustomEditor({
        id: 'contentConsumerForExtensionPointFilter',
        path: 'selectedContentConsumersForExtensionPoint',
        name: t('extensions.dependency-graph.content-consumers-extension-point', 'Content Consumers'),
        description: t(
          'extensions.dependency-graph.content-consumers-extension-point-description',
          'Extension Point Mode: select which content consumers (apps with extension points) to display (right side)'
        ),
        editor: ContentConsumerForExtensionPointMultiSelect,
        category: ['Filtering'],
        showIf: (currentConfig: PanelOptions) => {
          const shouldShow = currentConfig.visualizationMode === 'extensionpoint';
          console.log('ContentConsumerForExtensionPointMultiSelect showIf check', {
            visualizationMode: currentConfig.visualizationMode,
            shouldShow,
            currentConfig: currentConfig,
          });
          return shouldShow;
        },
        defaultValue: [], // Default to empty array (show all)
      })
      .addCustomEditor({
        id: 'extensionPointFilter',
        path: 'selectedExtensionPoints',
        name: t('extensions.dependency-graph.extension-points', 'Extension Points'),
        description: t(
          'extensions.dependency-graph.extension-points-description',
          'Extension Point Mode: select which extension points to display (right side)'
        ),
        editor: ExtensionPointMultiSelect,
        category: ['Filtering'],
        showIf: (currentConfig: PanelOptions) => currentConfig.visualizationMode === 'extensionpoint',
      })
  );
});
