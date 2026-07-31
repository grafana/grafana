import { set, unset } from 'lodash';

import { itemMatchers } from '../transformations/itemMatchers';
import { type ItemMatcher } from '../transformations/itemMatchers/itemMatchers';
import { type DataFrame, type FieldConfig } from '../types/dataFrame';
import { type DynamicConfigValue } from '../types/fieldOverrides';
import {
  type ItemKindContext,
  type ItemKindDescriptor,
  type ItemOverrideRule,
  type PanelItem,
} from '../types/itemOverrides';
import { type InterpolateFunction } from '../types/panel';

import { type FieldConfigOptionsRegistry } from './FieldConfigOptionsRegistry';

/**
 * @alpha
 */
export interface ApplyItemOverrideOptions {
  /** Every rule stored on the panel. Rules for other kinds are skipped. */
  itemOverrides: ItemOverrideRule[] | undefined;
  /** The kind being resolved. Only rules whose `matcher.kind` equals `kind.id` apply. */
  kind: ItemKindDescriptor;
  /** The property registry for this kind, from `PanelPlugin.getItemConfigRegistry`. */
  itemConfigRegistry: FieldConfigOptionsRegistry;
  data: DataFrame[];
  replaceVariables?: InterpolateFunction;
  /** Panel state the kind needs to enumerate its marks. */
  context: ItemKindContext;
}

interface ItemOverrideProps {
  match: ItemMatcher;
  properties: DynamicConfigValue[];
}

/**
 * Resolves the item override rules for one kind against the marks currently in the data.
 *
 * Returns a map keyed by item id, holding only the items at least one rule matched — an
 * absent entry means "no override", which callers can treat as "use the data-driven value".
 * Rules apply in array order and the last write wins per property, mirroring field overrides.
 *
 * The resolved value is a {@link FieldConfig} because item properties are ordinary
 * `FieldConfigPropertyItem`s and write to the same paths a field override would.
 *
 * @alpha
 */
export function applyItemOverrides<TItemConfig extends object = {}>(
  options: ApplyItemOverrideOptions
): Map<string, FieldConfig<TItemConfig>> {
  const { itemOverrides, kind, itemConfigRegistry, data, replaceVariables, context } = options;

  const resolved = new Map<string, FieldConfig<TItemConfig>>();
  if (!itemOverrides?.length) {
    return resolved;
  }

  // Prepare the matchers
  const override: ItemOverrideProps[] = [];
  for (const rule of itemOverrides) {
    if (rule.matcher.kind !== kind.id) {
      continue;
    }

    const info = itemMatchers.getIfExists(rule.matcher.id);
    if (!info) {
      console.warn(`Unknown item matcher id: "${rule.matcher.id}", skipping item override rule`);
      continue;
    }

    override.push({
      match: info.get(rule.matcher.options),
      properties: rule.properties,
    });
  }

  if (!override.length) {
    return resolved;
  }

  const items = kind.getItems(data, context);

  for (const item of items) {
    let config: FieldConfig<TItemConfig> | undefined;

    for (const rule of override) {
      if (!rule.match(item)) {
        continue;
      }

      // Only allocate for items a rule actually matched, so callers can use presence in the
      // map as the signal that an override exists.
      config ??= {};

      for (const prop of rule.properties) {
        setItemConfigValue(config, prop, {
          item,
          data,
          replaceVariables,
          itemConfigRegistry,
        });
      }
    }

    if (config) {
      resolved.set(item.id, config);
    }
  }

  return resolved;
}

interface ItemOverrideEnv {
  item: PanelItem;
  data: DataFrame[];
  replaceVariables?: InterpolateFunction;
  itemConfigRegistry: FieldConfigOptionsRegistry;
}

/**
 * The item-shaped counterpart of `setDynamicConfigValue`. Item property registries record the
 * `custom.` prefix in the id but not in the path, so custom values land under `custom` exactly
 * as they do for fields.
 */
function setItemConfigValue(config: object, value: DynamicConfigValue, context: ItemOverrideEnv) {
  const item = context.itemConfigRegistry.getIfExists(value.id);

  if (!item) {
    return;
  }

  // `process` expects a FieldOverrideContext. Items have no field, and every property offered
  // for an item is field-agnostic (`shouldApply: () => true`), so the field slot stays empty.
  const val = item.process(
    value.value,
    { data: context.data, replaceVariables: context.replaceVariables },
    item.settings
  );

  if (val === undefined || val === null) {
    unset(config, item.isCustom ? `custom.${item.path}` : item.path);
    return;
  }

  set(config, item.isCustom ? `custom.${item.path}` : item.path, val);
}
