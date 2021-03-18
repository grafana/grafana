import React, { useCallback } from 'react';
import { StandardEditorContext, VariableSuggestionsScope } from '@grafana/data';
import { get as lodashGet, set as lodashSet } from 'lodash';
import { getPanelOptionsVariableSuggestions } from 'app/features/panel/panellinks/link_srv';
import { OptionPaneRenderProps, OptionsPaneGroup } from './types';
import { updateDefaultFieldConfigValue } from './utils';

export function getVizualizationOptions(props: OptionPaneRenderProps): OptionsPaneGroup {
  const { plugin, panel, onPanelOptionsChanged, onFieldConfigsChange, data, eventBus } = props;
  const currentOptions = panel.getOptions();
  const currentFieldConfig = panel.fieldConfig;
  const mainCategory: OptionsPaneGroup = {
    title: plugin.meta.name + ' options',
    items: [],
    groups: [],
  };

  const categories: Record<string, OptionsPaneGroup> = {};

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

  /**
   * Panel options
   */
  for (const pluginOption of plugin.optionEditors.list()) {
    let optionCategory = mainCategory;
    const categoryNames = pluginOption.category;
    const categoryName = categoryNames && categoryNames.length && categoryNames[0];

    if (categoryName) {
      optionCategory = categories[categoryName];

      if (!optionCategory) {
        optionCategory = categories[categoryName] = {
          title: categoryName,
          items: [],
        };
        mainCategory.groups!.push(optionCategory);
      }
    }

    const Editor = pluginOption.editor;

    optionCategory.items!.push({
      title: pluginOption.name,
      description: pluginOption.description,
      reactNode: (
        <Editor
          value={lodashGet(currentOptions, pluginOption.path)}
          onChange={(value) => onOptionChange(pluginOption.path, value)}
          item={pluginOption}
          context={context}
        />
      ),
    });
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

    let optionCategory = mainCategory;
    const categoryNames = fieldOption.category;
    const categoryName = categoryNames && categoryNames.length && categoryNames[0];

    if (categoryName) {
      optionCategory = categories[categoryName];

      if (!optionCategory) {
        optionCategory = categories[categoryName] = {
          title: categoryName,
          items: [],
        };
        mainCategory.groups!.push(optionCategory);
      }
    }

    const Editor = fieldOption.editor;

    const defaults = currentFieldConfig.defaults;
    const value = fieldOption.isCustom
      ? defaults.custom
        ? lodashGet(defaults.custom, fieldOption.path)
        : undefined
      : lodashGet(defaults, fieldOption.path);

    optionCategory.items!.push({
      title: fieldOption.name,
      description: fieldOption.description,
      reactNode: (
        <Editor
          value={value}
          onChange={(v) => onDefaultValueChange(fieldOption.path, v, fieldOption.isCustom)}
          item={fieldOption}
          context={context}
        />
      ),
    });
  }

  return mainCategory;
}
