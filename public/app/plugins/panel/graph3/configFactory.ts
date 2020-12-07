import { ConfigOverrideRule, FieldConfigSource, FieldMatcherID, getFieldDisplayName } from '@grafana/data';
import { GraphNGLegendEvent, GraphNGLegendEventMode } from '@grafana/ui';

export const displayConfigFactory = (
  event: GraphNGLegendEvent,
  fieldConfig: FieldConfigSource<any>
): FieldConfigSource<any> => {
  const { field, frame, data, mode } = event;
  const { overrides } = fieldConfig;
  const displayName = getFieldDisplayName(field, frame, data);

  // currently we assume that the last config is the one
  // toggling the series visibility. Should be replaced by
  // some logic that try to find the "system" config in the list.
  const currentIndex = overrides.length - 1;

  if (currentIndex < 0) {
    const override = createFreshOverride(displayName);

    return {
      ...fieldConfig,
      overrides: [...fieldConfig.overrides, override],
    };
  }

  const overridesCopy = Array.from(overrides);
  const [current] = overridesCopy.splice(currentIndex, 1);

  if (mode === GraphNGLegendEventMode.select) {
    const override = createFreshOverride(displayName);

    return {
      ...fieldConfig,
      overrides: [...overridesCopy, override],
    };
  }

  const override = createExtendedOverride(current, displayName);

  return {
    ...fieldConfig,
    overrides: [...overridesCopy, override],
  };
};

const createFreshOverride = (displayName: string): ConfigOverrideRule => {
  return {
    matcher: {
      id: FieldMatcherID.byRegexp,
      options: `^(?!${displayName}$).*$`,
    },
    properties: [
      {
        id: 'custom.seriesConfig',
        value: {
          displayInGraph: false,
          displayInLegend: true,
          displayInTooltip: true,
        },
      },
    ],
  };
};

const createExtendedOverride = (current: ConfigOverrideRule, displayName: string): ConfigOverrideRule => {
  const property = current.properties.find(p => p.id === 'custom.seriesConfig') ?? {
    id: 'custom.seriesConfig',
    value: {
      displayInGraph: false,
      displayInLegend: true,
      displayInTooltip: true,
    },
  };

  const combined = combinedMatcher(current, displayName);

  return {
    matcher: {
      id: FieldMatcherID.byRegexp,
      options: `^(?!${combined}$).*$`,
    },
    properties: [
      {
        ...property,
        value: {
          ...property.value,
          displayInGraph: false,
        },
      },
    ],
  };
};

const combinedMatcher = (current: ConfigOverrideRule, displayName: string): string => {
  const match = /^\^\(\?\!([\w|-]+)\$\)\.\*\$$/.exec(current.matcher.options);

  if (match?.length === 2) {
    return `${displayName}|${match[1]}`;
  }

  return displayName;
};
