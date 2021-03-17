import React, { useMemo } from 'react';
import {
  DataFrame,
  EventBus,
  InterpolateFunction,
  PanelOptionsEditorItem,
  PanelPlugin,
  StandardEditorContext,
  VariableSuggestionsScope,
} from '@grafana/data';
import { get as lodashGet, set as lodashSet } from 'lodash';
import { Field, Label } from '@grafana/ui';
import groupBy from 'lodash/groupBy';
import { OptionsGroup } from './OptionsGroup';
import { getPanelOptionsVariableSuggestions } from 'app/features/panel/panellinks/link_srv';
import { OptionPaneRenderProps, OptionsPaneGroup } from './types';

interface PanelOptionsEditorProps<TOptions> {
  plugin: PanelPlugin;
  data?: DataFrame[];
  replaceVariables: InterpolateFunction;
  eventBus: EventBus;
  options: TOptions;
  onChange: (options: TOptions) => void;
}
const DISPLAY_OPTIONS_CATEGORY = 'Visualization settings';
export const PanelOptionsEditor: React.FC<PanelOptionsEditorProps<any>> = ({
  plugin,
  options,
  onChange,
  data,
  eventBus,
  replaceVariables,
}) => {
  const optionEditors = useMemo<Record<string, PanelOptionsEditorItem[]>>(() => {
    return groupBy(plugin.optionEditors.list(), (i) => {
      if (!i.category) {
        return DISPLAY_OPTIONS_CATEGORY;
      }
      return i.category[0] ? i.category[0] : DISPLAY_OPTIONS_CATEGORY;
    });
  }, [plugin]);

  const onOptionChange = (key: string, value: any) => {
    const newOptions = lodashSet({ ...options }, key, value);
    onChange(newOptions);
  };

  const context: StandardEditorContext<any> = {
    data: data || [],
    replaceVariables,
    options,
    eventBus,
    getSuggestions: (scope?: VariableSuggestionsScope) => {
      return getPanelOptionsVariableSuggestions(plugin, data);
    },
  };

  return (
    <>
      {Object.keys(optionEditors).map((c, i) => {
        const optionsToShow = optionEditors[c]
          .map((e, j) => {
            if (e.showIf && !e.showIf(options, data)) {
              return null;
            }

            const label = (
              <Label description={e.description} category={e.category?.slice(1) as string[]}>
                {e.name}
              </Label>
            );
            return (
              <Field label={label} key={`${e.id}/${j}`}>
                <e.editor
                  value={lodashGet(options, e.path)}
                  onChange={(value) => onOptionChange(e.path, value)}
                  item={e}
                  context={context}
                />
              </Field>
            );
          })
          .filter((e) => e !== null);

        return optionsToShow.length > 0 ? (
          <OptionsGroup title={c} defaultToClosed id={`${c}/${i}`} key={`${c}/${i}`}>
            <div>{optionsToShow}</div>
          </OptionsGroup>
        ) : null;
      })}
    </>
  );
};

export function getVizualizationSettings(props: OptionPaneRenderProps): OptionsPaneGroup {
  const { plugin, panel, onPanelOptionsChanged, data, eventBus } = props;
  const currentOptions = panel.getOptions();
  const mainCategory: OptionsPaneGroup = {
    title: plugin.meta.name + ' options',
    items: [],
    groups: [],
  };

  const categories: Record<string, OptionsPaneGroup> = {};

  const onOptionChange = (key: string, value: any) => {
    const newOptions = lodashSet({ ...currentOptions }, key, value);
    onPanelOptionsChanged(newOptions);
  };

  const context: StandardEditorContext<any> = {
    data: data?.series || [],
    replaceVariables: panel.replaceVariables,
    options: currentOptions,
    eventBus,
    getSuggestions: (scope?: VariableSuggestionsScope) => {
      return getPanelOptionsVariableSuggestions(plugin, data?.series);
    },
  };

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

  return mainCategory;
}
