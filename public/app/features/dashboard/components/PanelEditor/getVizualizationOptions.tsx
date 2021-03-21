import React, { useCallback } from 'react';
import { StandardEditorContext, VariableSuggestionsScope } from '@grafana/data';
import { get as lodashGet, set as lodashSet } from 'lodash';
import { getPanelOptionsVariableSuggestions } from 'app/features/panel/panellinks/link_srv';
import { OptionPaneRenderProps } from './types';
import { updateDefaultFieldConfigValue } from './utils';
import { OptionsPaneCategoryDescriptor, OptionsPaneItemDescriptor } from './OptionsPaneItems';

export function getVizualizationOptions(props: OptionPaneRenderProps): OptionsPaneCategoryDescriptor[] {
  const { plugin, panel, onPanelOptionsChanged, onFieldConfigsChange, data, eventBus } = props;
  const currentOptions = panel.getOptions();
  const currentFieldConfig = panel.fieldConfig;
  const categoryIndex: Record<string, OptionsPaneCategoryDescriptor> = {};

  const onOptionChange = useCallback(
    (key: string, value: any) => {
      const newOptions = lodashSet({ ...currentOptions }, key, value);
      onPanelOptionsChanged(newOptions);
    },
    [currentOptions, onPanelOptionsChanged]
  );

  const onDefaultValueChange = useCallback(
    (name: string, value: any, isCustom: boolean | undefined) => {
      onFieldConfigsChange(updateDefaultFieldConfigValue(currentFieldConfig, name, value, isCustom));
    },
    [currentFieldConfig, onFieldConfigsChange]
  );

  const context: StandardEditorContext<any> = {
    data: data?.series || [],
    replaceVariables: panel.replaceVariables,
    options: currentOptions,
    eventBus,
    getSuggestions: (scope?: VariableSuggestionsScope) => {
      return getPanelOptionsVariableSuggestions(plugin, data?.series);
    },
  };

  const getOptionsPaneCategory = (categoryNames?: string[]): OptionsPaneCategoryDescriptor => {
    const categoryName = (categoryNames && categoryNames[0]) ?? `${plugin.meta.name}`;
    const category = categoryIndex[categoryName];

    if (category) {
      return category;
    }

    return (categoryIndex[categoryName] = new OptionsPaneCategoryDescriptor({
      title: categoryName,
      id: categoryName,
    }));
  };

  /**
   * Panel options
   */
  for (const pluginOption of plugin.optionEditors.list()) {
    const category = getOptionsPaneCategory(pluginOption.category);
    const Editor = pluginOption.editor;

    category.addItem(
      new OptionsPaneItemDescriptor({
        title: pluginOption.name,
        description: pluginOption.description,
        render: function renderEditor() {
          return (
            <Editor
              value={lodashGet(currentOptions, pluginOption.path)}
              onChange={(value) => onOptionChange(pluginOption.path, value)}
              item={pluginOption}
              context={context}
            />
          );
        },
      })
    );
  }

  /**
   * Field options
   */
  for (const fieldOption of plugin.fieldConfigRegistry.list()) {
    if (
      fieldOption.isCustom &&
      fieldOption.showIf &&
      !fieldOption.showIf(currentFieldConfig.defaults.custom, data?.series)
    ) {
      continue;
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

    category.addItem(
      new OptionsPaneItemDescriptor({
        title: fieldOption.name,
        description: fieldOption.description,
        render: function renderEditor() {
          return (
            <Editor
              value={value}
              onChange={(v) => onDefaultValueChange(fieldOption.path, v, fieldOption.isCustom)}
              item={fieldOption}
              context={context}
            />
          );
        },
      })
    );
  }

  return Object.values(categoryIndex);
}
