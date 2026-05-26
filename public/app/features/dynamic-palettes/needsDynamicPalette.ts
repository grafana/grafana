import { type FieldConfigSource, fieldColorModeRegistry } from '@grafana/data';

function isUnknownColorMode(mode: unknown): boolean {
  if (typeof mode !== 'string' || mode.length === 0) {
    return false;
  }

  return fieldColorModeRegistry.getIfExists(mode) === undefined;
}

export function needsDynamicPalette(fieldConfig: FieldConfigSource | undefined): boolean {
  if (!fieldConfig) {
    return false;
  }

  if (isUnknownColorMode(fieldConfig.defaults?.color?.mode)) {
    return true;
  }

  // Field overrides can also set a color mode via { id: 'color', value: { mode } },
  // so a panel can depend on a dynamic palette without ever touching defaults.color.
  for (const override of fieldConfig.overrides ?? []) {
    for (const property of override.properties ?? []) {
      if (property.id !== 'color') {
        continue;
      }

      const value: unknown = property.value;
      if (value && typeof value === 'object' && 'mode' in value && isUnknownColorMode(value.mode)) {
        return true;
      }
    }
  }

  return false;
}
