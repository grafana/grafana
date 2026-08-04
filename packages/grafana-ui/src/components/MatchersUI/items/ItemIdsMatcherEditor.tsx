import { memo, useCallback, useMemo } from 'react';

import {
  type DataFrame,
  type ItemKindContext,
  type ItemKindDescriptor,
  ItemMatcherID,
  itemMatchers,
} from '@grafana/data';
import { t } from '@grafana/i18n';

import { MultiCombobox } from '../../Combobox/MultiCombobox';
import { type ComboboxOption } from '../../Combobox/types';

import { type ItemMatcherUIProps, type ItemMatcherUIRegistryItem } from './types';

/**
 * Builds the selectable options for a kind, keeping any stored id that is no longer in the data
 * visible as "(not found)" rather than silently dropping it — the same contract byName has.
 */
export function useItemOptions(
  kind: ItemKindDescriptor,
  data: DataFrame[],
  itemContext: ItemKindContext,
  currentIds: string[]
): Array<ComboboxOption<string>> {
  return useMemo(() => {
    const items = kind.getItems(data, itemContext);
    const options: Array<ComboboxOption<string>> = items.map((item) => ({
      value: item.id,
      label: item.label ?? item.id,
      description: item.description,
    }));

    const present = new Set(items.map((item) => item.id));
    for (const id of currentIds) {
      if (!present.has(id)) {
        options.push({
          value: id,
          label: t('grafana-ui.matchers.labels.not-found', '{{name}} (not found)', { name: id }),
        });
      }
    }

    return options;
  }, [kind, data, itemContext, currentIds]);
}

export const ItemIdsMatcherEditor = memo<ItemMatcherUIProps<string[]>>((props) => {
  const { id, kind, data, itemContext, options, onChange } = props;
  const currentIds = useMemo(() => options ?? [], [options]);
  const selectOptions = useItemOptions(kind, data, itemContext, currentIds);

  const onSelectionChange = useCallback(
    (selections: Array<ComboboxOption<string>>) => {
      onChange(selections.map((selection) => selection.value));
    },
    [onChange]
  );

  return <MultiCombobox id={id} value={currentIds} options={selectOptions} onChange={onSelectionChange} />;
});
ItemIdsMatcherEditor.displayName = 'ItemIdsMatcherEditor';

export const getItemIdsMatcherItem: () => ItemMatcherUIRegistryItem<string[]> = () => ({
  id: ItemMatcherID.byItemIds,
  component: ItemIdsMatcherEditor,
  matcher: itemMatchers.get(ItemMatcherID.byItemIds),
  name: t('grafana-ui.item-matchers-ui.name-items-with-id', 'Items with id'),
  description: t('grafana-ui.item-matchers-ui.description-items-with-id', 'Set properties for specific items'),
  optionsToLabel: (options) => (options ?? []).join(', '),
});
