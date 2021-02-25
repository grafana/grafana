import {
  ConfigOverrideRule,
  DynamicConfigValue,
  FieldColorModeId,
  FieldConfigSource,
  FieldMatcherID,
} from '@grafana/data';

export const changeSeriesColorConfigFactory = (
  label: string,
  color: string,
  fieldConfig: FieldConfigSource
): FieldConfigSource => {
  const { overrides } = fieldConfig;
  const currentIndex = fieldConfig.overrides.findIndex((override) => {
    return override.matcher.id === FieldMatcherID.byName && override.matcher.options === label;
  });

  if (currentIndex < 0) {
    return {
      ...fieldConfig,
      overrides: [...fieldConfig.overrides, createOverride(label, color)],
    };
  }

  const overridesCopy = Array.from(overrides);
  const existing = overridesCopy[currentIndex];
  const propertyIndex = existing.properties.findIndex((p) => p.id === 'color');

  if (propertyIndex < 0) {
    overridesCopy[currentIndex] = {
      ...existing,
      properties: [...existing.properties, createProperty(color)],
    };

    return {
      ...fieldConfig,
      overrides: overridesCopy,
    };
  }

  const propertiesCopy = Array.from(existing.properties);
  propertiesCopy[propertyIndex] = createProperty(color);

  overridesCopy[currentIndex] = {
    ...existing,
    properties: propertiesCopy,
  };

  return {
    ...fieldConfig,
    overrides: overridesCopy,
  };
};

const createOverride = (label: string, color: string): ConfigOverrideRule => {
  return {
    matcher: {
      id: FieldMatcherID.byName,
      options: label,
    },
    properties: [createProperty(color)],
  };
};

const createProperty = (color: string): DynamicConfigValue => {
  return {
    id: 'color',
    value: {
      mode: FieldColorModeId.Fixed,
      fixedColor: color,
    },
  };
};
