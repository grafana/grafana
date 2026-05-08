import {
  type ConfigOverrideRule,
  type FieldConfigSource,
  FieldMatcherID,
} from '@grafana/data';
import { type MatcherScope } from '@grafana/schema';

const COLUMN_WIDTH_PROP_ID = 'custom.width';

/**
 * Returns a new field config with column width applied for the given field display name.
 * Reuses an existing override when the matcher matches (including when `matcher.scope` is omitted —
 * it defaults to `'series'`, consistent with field override application in `@grafana/data`).
 */
export function applyColumnWidthOverride(
  fieldConfig: FieldConfigSource,
  fieldDisplayName: string,
  width: number,
  fieldScope: MatcherScope = 'series'
): FieldConfigSource {
  const overrides = fieldConfig.overrides ?? [];

  const matcherId = FieldMatcherID.byName;

  const matchesExistingRule = (o: ConfigOverrideRule) =>
    o.matcher.id === matcherId &&
    o.matcher.options === fieldDisplayName &&
    (o.matcher.scope ?? 'series') === fieldScope;

  const existingIndex = overrides.findIndex(matchesExistingRule);

  let newOverrides: ConfigOverrideRule[];

  if (existingIndex >= 0) {
    const existing = overrides[existingIndex];
    const propIndex = existing.properties.findIndex((prop) => prop.id === COLUMN_WIDTH_PROP_ID);
    newOverrides = [...overrides];
    if (propIndex >= 0) {
      const newProperties = [...existing.properties];
      newProperties[propIndex] = { ...newProperties[propIndex], value: width };
      newOverrides[existingIndex] = { ...existing, properties: newProperties };
    } else {
      newOverrides[existingIndex] = {
        ...existing,
        properties: [...existing.properties, { id: COLUMN_WIDTH_PROP_ID, value: width }],
      };
    }
  } else {
    newOverrides = [
      ...overrides,
      {
        matcher: { id: matcherId, options: fieldDisplayName, scope: fieldScope },
        properties: [{ id: COLUMN_WIDTH_PROP_ID, value: width }],
      },
    ];
  }

  return {
    ...fieldConfig,
    overrides: newOverrides,
  };
}
