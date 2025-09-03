import { get as lodashGet } from 'lodash';

import {
  EventBus,
  InterpolateFunction,
  PanelData,
  PanelPlugin,
  StandardEditorContext,
  VariableSuggestionsScope,
  PanelOptionsEditorBuilder,
} from '@grafana/data';
import { NestedValueAccess, isNestedPanelOptions, PanelOptionsSupplier } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { VizPanel } from '@grafana/scenes';
import { Input } from '@grafana/ui';
import { LibraryVizPanelInfo } from 'app/features/dashboard-scene/panel-edit/LibraryVizPanelInfo';
import { LibraryPanelBehavior } from 'app/features/dashboard-scene/scene/LibraryPanelBehavior';
import { getDataLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';

import { OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from './OptionsPaneItemDescriptor';
import { getOptionOverrides } from './state/getOptionOverrides';
import { OptionPaneRenderProps } from './types';
import { setOptionImmutably, updateDefaultFieldConfigValue } from './utils';

type categoryGetter = (categoryNames?: string[]) => OptionsPaneCategoryDescriptor;

interface GetStandardEditorContextProps {
  data: PanelData | undefined;
  replaceVariables: InterpolateFunction;
  options: Record<string, unknown>;
  eventBus: EventBus;
  instanceState: OptionPaneRenderProps['instanceState'];
}

export function getStandardEditorContext({
  data,
  replaceVariables,
  options,
  eventBus,
  instanceState,
}: GetStandardEditorContextProps): StandardEditorContext<unknown, unknown> {
  const dataSeries = data?.series ?? [];

  const context: StandardEditorContext<unknown, unknown> = {
    data: dataSeries,
    replaceVariables,
    options,
    eventBus,
    getSuggestions: (scope?: VariableSuggestionsScope) => getDataLinksVariableSuggestions(dataSeries, scope),
    instanceState,
    annotations: data?.annotations,
  };

  return context;
}

export function getVisualizationOptions(props: OptionPaneRenderProps): OptionsPaneCategoryDescriptor[] {
  const { plugin, panel, onPanelOptionsChanged, onFieldConfigsChange, data, dashboard, instanceState } = props;
  const currentOptions = panel.getOptions();
  const currentFieldConfig = panel.fieldConfig;
  const categoryIndex: Record<string, OptionsPaneCategoryDescriptor> = {};

  const context = getStandardEditorContext({
    data,
    replaceVariables: panel.replaceVariables,
    options: currentOptions,
    eventBus: dashboard.events,
    instanceState,
  });

  const getOptionsPaneCategory = (categoryNames?: string[]): OptionsPaneCategoryDescriptor => {
    const categoryName = (categoryNames && categoryNames[0]) ?? `${plugin.meta.name}`;
    const category = categoryIndex[categoryName];

    if (category) {
      return category;
    }

    return (categoryIndex[categoryName] = new OptionsPaneCategoryDescriptor({
      title: categoryName,
      id: categoryName,
      sandboxId: plugin.meta.id,
    }));
  };

  const access: NestedValueAccess = {
    getValue: (path) => lodashGet(currentOptions, path),
    onChange: (path, value) => {
      const newOptions = setOptionImmutably(currentOptions, path, value);
      onPanelOptionsChanged(newOptions);
    },
  };

  // Load the options into categories
  fillOptionsPaneItems(plugin.meta.id, plugin.getPanelOptionsSupplier(), access, getOptionsPaneCategory, context);

  /**
   * Field options
   */
  for (const fieldOption of plugin.fieldConfigRegistry.list()) {
    if (fieldOption.isCustom) {
      if (
        fieldOption.showIf &&
        !fieldOption.showIf(currentFieldConfig.defaults.custom, data?.series, data?.annotations)
      ) {
        continue;
      }
    } else {
      if (fieldOption.showIf && !fieldOption.showIf(currentFieldConfig.defaults, data?.series, data?.annotations)) {
        continue;
      }
    }

    if (fieldOption.hideFromDefaults) {
      continue;
    }

    const category = getOptionsPaneCategory(fieldOption.category);
    const Editor = fieldOption.editor;

    const defaults = currentFieldConfig.defaults;
    const value = fieldOption.isCustom
      ? defaults.custom
        ? lodashGet(defaults.custom, fieldOption.path)
        : undefined
      : lodashGet(defaults, fieldOption.path);

    if (fieldOption.getItemsCount) {
      category.props.itemsCount = fieldOption.getItemsCount(value);
    }

    const htmlId = `${plugin.meta.id}-${fieldOption.path}`;
    category.addItem(
      new OptionsPaneItemDescriptor({
        title: fieldOption.name,
        id: htmlId,
        description: fieldOption.description,
        overrides: getOptionOverrides(fieldOption, currentFieldConfig, data?.series),
        render: function renderEditor() {
          const onChange = (v: unknown) => {
            onFieldConfigsChange(
              updateDefaultFieldConfigValue(currentFieldConfig, fieldOption.path, v, fieldOption.isCustom)
            );
          };

          return <Editor value={value} onChange={onChange} item={fieldOption} context={context} id={htmlId} />;
        },
      })
    );
  }

  return Object.values(categoryIndex);
}

export function getLibraryVizPanelOptionsCategory(libraryPanel: LibraryPanelBehavior): OptionsPaneCategoryDescriptor {
  const descriptor = new OptionsPaneCategoryDescriptor({
    title: t(
      'dashboard.get-library-viz-panel-options-category.descriptor.title.library-panel-options',
      'Library panel options'
    ),
    id: 'Library panel options',
    isOpenDefault: true,
  });

  descriptor
    .addItem(
      new OptionsPaneItemDescriptor({
        title: t('dashboard.get-library-viz-panel-options-category.title.name', 'Name'),
        id: 'library-panel-name',
        value: libraryPanel,
        popularRank: 1,
        render: function renderName(descriptor) {
          return (
            <Input
              id={descriptor.props.id}
              data-testid="library panel name input"
              defaultValue={libraryPanel.state.name}
              onBlur={(e) => libraryPanel.setState({ name: e.currentTarget.value })}
            />
          );
        },
      })
    )
    .addItem(
      new OptionsPaneItemDescriptor({
        title: t('dashboard.get-library-viz-panel-options-category.title.information', 'Information'),
        id: 'library-panel-information',
        render: function renderLibraryPanelInformation() {
          return <LibraryVizPanelInfo libraryPanel={libraryPanel} />;
        },
      })
    );

  return descriptor;
}

export interface OptionPaneRenderProps2 {
  panel: VizPanel;
  eventBus: EventBus;
  plugin: PanelPlugin;
  data?: PanelData;
  instanceState: unknown;
}

export function getVisualizationOptions2(props: OptionPaneRenderProps2): OptionsPaneCategoryDescriptor[] {
  const { plugin, panel, data, eventBus, instanceState } = props;

  const categoryIndex: Record<string, OptionsPaneCategoryDescriptor> = {};
  const getOptionsPaneCategory = (categoryNames?: string[]): OptionsPaneCategoryDescriptor => {
    const categoryName = categoryNames?.[0] ?? plugin.meta.name;
    const category = categoryIndex[categoryName];

    if (category) {
      return category;
    }

    return (categoryIndex[categoryName] = new OptionsPaneCategoryDescriptor({
      title: categoryName,
      id: categoryName,
      sandboxId: plugin.meta.id,
    }));
  };

  const currentOptions = panel.state.options;
  const access: NestedValueAccess = {
    getValue: (path) => lodashGet(currentOptions, path),
    onChange: (path, value) => {
      const newOptions = setOptionImmutably(currentOptions, path, value);
      panel.onOptionsChange(newOptions);
    },
  };

  const context = getStandardEditorContext({
    data,
    replaceVariables: panel.interpolate,
    options: currentOptions,
    eventBus: eventBus,
    instanceState,
  });

  // Load the options into categories
  fillOptionsPaneItems(plugin.meta.id, plugin.getPanelOptionsSupplier(), access, getOptionsPaneCategory, context);

  // Field options
  const currentFieldConfig = panel.state.fieldConfig;
  for (const fieldOption of plugin.fieldConfigRegistry.list()) {
    const hideOption =
      fieldOption.showIf &&
      (fieldOption.isCustom
        ? !fieldOption.showIf(currentFieldConfig.defaults.custom, data?.series, data?.annotations)
        : !fieldOption.showIf(currentFieldConfig.defaults, data?.series, data?.annotations));
    if (fieldOption.hideFromDefaults || hideOption) {
      continue;
    }

    const category = getOptionsPaneCategory(fieldOption.category);
    const Editor = fieldOption.editor;

    const defaults = currentFieldConfig.defaults;
    const value = fieldOption.isCustom
      ? defaults.custom
        ? lodashGet(defaults.custom, fieldOption.path)
        : undefined
      : lodashGet(defaults, fieldOption.path);

    if (fieldOption.getItemsCount) {
      category.props.itemsCount = fieldOption.getItemsCount(value);
    }

    const htmlId = `${plugin.meta.id}-${fieldOption.path}`;
    category.addItem(
      new OptionsPaneItemDescriptor({
        title: fieldOption.name,
        id: htmlId,
        description: fieldOption.description,
        overrides: getOptionOverrides(fieldOption, currentFieldConfig, data?.series),
        render: function renderEditor() {
          const onChange = (v: unknown) => {
            panel.onFieldConfigChange(
              updateDefaultFieldConfigValue(currentFieldConfig, fieldOption.path, v, fieldOption.isCustom),
              true
            );
          };

          return <Editor value={value} onChange={onChange} item={fieldOption} context={context} id={htmlId} />;
        },
      })
    );
  }

  return Object.values(categoryIndex);
}

/**
 * This will iterate all options panes and add register them with the configured categories
 *
 * @internal
 */
export function fillOptionsPaneItems(
  idPrefix: string,
  supplier: PanelOptionsSupplier<any>,
  access: NestedValueAccess,
  getOptionsPaneCategory: categoryGetter,
  context: StandardEditorContext<any>,
  parentCategory?: OptionsPaneCategoryDescriptor
) {
  const builder = new PanelOptionsEditorBuilder();
  supplier(builder, context);

  for (const pluginOption of builder.getItems()) {
    if (pluginOption.showIf && !pluginOption.showIf(context.options, context.data, context.annotations)) {
      continue;
    }

    const htmlId = `${idPrefix}-${pluginOption.id}`;

    let category = parentCategory;
    if (!category) {
      category = getOptionsPaneCategory(pluginOption.category);
    } else if (pluginOption.category?.[0]?.length) {
      category = category.getCategory(pluginOption.category[0]);
    }

    // Nested options get passed up one level
    if (isNestedPanelOptions(pluginOption)) {
      const subAccess = pluginOption.getNestedValueAccess(access);
      const subContext = subAccess.getContext
        ? subAccess.getContext(context)
        : { ...context, options: access.getValue(pluginOption.path) };

      fillOptionsPaneItems(
        htmlId,
        pluginOption.getBuilder(),
        subAccess,
        getOptionsPaneCategory,
        subContext,
        category // parent category
      );
      continue;
    }

    const Editor = pluginOption.editor;
    category.addItem(
      new OptionsPaneItemDescriptor({
        title: pluginOption.name,
        id: htmlId,
        description: pluginOption.description,
        render: function renderEditor() {
          return (
            <Editor
              value={access.getValue(pluginOption.path)}
              onChange={(value) => {
                access.onChange(pluginOption.path, value);
              }}
              item={pluginOption}
              context={context}
              id={htmlId}
            />
          );
        },
      })
    );
  }
}
