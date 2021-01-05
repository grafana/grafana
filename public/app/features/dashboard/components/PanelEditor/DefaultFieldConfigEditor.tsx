import React, { useCallback, ReactNode } from 'react';
import { get, groupBy } from 'lodash';
import { Counter, Field, Label } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { updateDefaultFieldConfigValue } from './utils';
import { FieldConfigPropertyItem, FieldConfigSource, VariableSuggestionsScope } from '@grafana/data';
import { getDataLinksVariableSuggestions } from '../../../panel/panellinks/link_srv';
import { OptionsGroup } from './OptionsGroup';
import { Props } from './types';

export const DefaultFieldConfigEditor: React.FC<Props> = ({ data, onChange, config, plugin }) => {
  const onDefaultValueChange = useCallback(
    (name: string, value: any, isCustom: boolean | undefined) => {
      onChange(updateDefaultFieldConfigValue(config, name, value, isCustom));
    },
    [config, onChange]
  );

  const renderEditor = useCallback(
    (item: FieldConfigPropertyItem, categoryItemCount: number) => {
      if (item.isCustom && item.showIf && !item.showIf(config.defaults.custom)) {
        return null;
      }

      if (item.hideFromDefaults) {
        return null;
      }

      const defaults = config.defaults;
      const value = item.isCustom
        ? defaults.custom
          ? get(defaults.custom, item.path)
          : undefined
        : get(defaults, item.path);

      let label: ReactNode | undefined = (
        <Label description={item.description} category={item.category?.slice(1)}>
          {item.name}
        </Label>
      );

      // hide label if there is only one item and category name is same as item, name
      if (categoryItemCount === 1 && item.category?.[0] === item.name) {
        label = undefined;
      }

      return (
        <Field
          label={label}
          key={`${item.id}/${item.isCustom}`}
          aria-label={selectors.components.PanelEditor.FieldOptions.propertyEditor(
            item.isCustom ? 'Custom' : 'Default'
          )}
        >
          <item.editor
            item={item}
            value={value}
            onChange={v => onDefaultValueChange(item.path, v, item.isCustom)}
            context={{
              data,
              getSuggestions: (scope?: VariableSuggestionsScope) => getDataLinksVariableSuggestions(data, scope),
            }}
          />
        </Field>
      );
    },
    [config]
  );

  const groupedConfigs = groupBy(plugin.fieldConfigRegistry.list(), i => i.category && i.category[0]);

  return (
    <div aria-label={selectors.components.FieldConfigEditor.content}>
      {Object.keys(groupedConfigs).map((k, i) => {
        const groupItemsCounter = countGroupItems(groupedConfigs[k], config);

        return (
          <OptionsGroup
            renderTitle={isExpanded => {
              return (
                <>
                  {k} {!isExpanded && groupItemsCounter && <Counter value={groupItemsCounter} />}
                </>
              );
            }}
            id={`${k}/${i}`}
            key={`${k}/${i}`}
          >
            {groupedConfigs[k].map(c => {
              return renderEditor(c, groupedConfigs[k].length);
            })}
          </OptionsGroup>
        );
      })}
    </div>
  );
};

const countGroupItems = (group: FieldConfigPropertyItem[], config: FieldConfigSource) => {
  let counter = 0;

  for (const item of group) {
    const value = item.isCustom
      ? config.defaults.custom
        ? config.defaults.custom[item.path]
        : undefined
      : (config.defaults as any)[item.path];
    if (item.getItemsCount && item.getItemsCount(value) > 0) {
      counter = counter + item.getItemsCount(value);
    }
  }

  return counter === 0 ? undefined : counter;
};
