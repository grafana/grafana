import React, { useCallback, ReactElement } from 'react';
import { StandardEditorContext, VariableSuggestionsScope } from '@grafana/data';
import { get as lodashGet, set as lodashSet } from 'lodash';
import { getPanelOptionsVariableSuggestions } from 'app/features/panel/panellinks/link_srv';
import { OptionPaneRenderProps } from './types';
import { updateDefaultFieldConfigValue } from './utils';
import { OptionsPaneItem } from './OptionsPaneItem';
import { OptionsPaneCategory, OptionsPaneCategoryProps } from './OptionsPaneCategory';

export function getVizualizationOptions(props: OptionPaneRenderProps): Array<ReactElement<OptionsPaneCategoryProps>> {
  const { plugin, panel, onPanelOptionsChanged, onFieldConfigsChange, data, eventBus } = props;
  const currentOptions = panel.getOptions();
  const currentFieldConfig = panel.fieldConfig;
  const categoryIndex: Record<string, ReactElement[]> = {};

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

  const getOptionsPaneCategory = (categoryNames?: string[]): ReactElement[] => {
    const categoryName = (categoryNames && categoryNames[0]) ?? `${plugin.meta.name}`;
    const categoryItems = categoryIndex[categoryName];

    if (categoryItems) {
      return categoryItems;
    }

    return (categoryIndex[categoryName] = []);
  };

  /**
   * Panel options
   */
  for (const pluginOption of plugin.optionEditors.list()) {
    const categoryItems = getOptionsPaneCategory(pluginOption.category);
    const Editor = pluginOption.editor;

    categoryItems.push(
      <OptionsPaneItem title={pluginOption.name} description={pluginOption.description} key={pluginOption.name}>
        <Editor
          value={lodashGet(currentOptions, pluginOption.path)}
          onChange={(value) => onOptionChange(pluginOption.path, value)}
          item={pluginOption}
          context={context}
        />
      </OptionsPaneItem>
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

    const categoryItems = getOptionsPaneCategory(fieldOption.category);
    const Editor = fieldOption.editor;

    const defaults = currentFieldConfig.defaults;
    const value = fieldOption.isCustom
      ? defaults.custom
        ? lodashGet(defaults.custom, fieldOption.path)
        : undefined
      : lodashGet(defaults, fieldOption.path);

    categoryItems.push(
      <OptionsPaneItem title={fieldOption.name} description={fieldOption.description} key={fieldOption.name}>
        <Editor
          value={value}
          onChange={(v) => onDefaultValueChange(fieldOption.path, v, fieldOption.isCustom)}
          item={fieldOption}
          context={context}
        />
      </OptionsPaneItem>
    );
  }

  return Object.keys(categoryIndex).map((name) => (
    <OptionsPaneCategory id={name} key={name} title={name}>
      {categoryIndex[name]}
    </OptionsPaneCategory>
  ));
}
