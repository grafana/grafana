import {
  DataFrame,
  FieldConfigSource,
  FieldMatcherID,
  getFieldDisplayName,
  isSystemOverride,
  SystemConfigOverrideRule,
} from '@grafana/data';
import { GraphNGLegendEvent, GraphNGLegendEventMode } from '@grafana/ui';

const displayOverrideRef = 'series_display';
const isDisplayOverride = isSystemOverride(displayOverrideRef);

export const displayConfigFactory = (
  event: GraphNGLegendEvent,
  fieldConfig: FieldConfigSource<any>,
  data: DataFrame[]
): FieldConfigSource<any> => {
  const { fieldIndex, mode } = event;
  const { overrides } = fieldConfig;

  const frame = data[fieldIndex.frameIndex];
  const field = frame.fields[fieldIndex.fieldIndex];
  const displayName = getFieldDisplayName(field, frame, data);
  const currentIndex = overrides.findIndex(isDisplayOverride);

  if (currentIndex < 0) {
    const override = createFreshOverride(displayName);

    return {
      ...fieldConfig,
      overrides: [override, ...fieldConfig.overrides],
    };
  }

  const overridesCopy = Array.from(overrides);
  const [current] = overridesCopy.splice(currentIndex, 1) as SystemConfigOverrideRule[];

  if (mode === GraphNGLegendEventMode.select) {
    const existing = matchersInConfig(current);

    if (existing.find(name => name === displayName)) {
      return {
        ...fieldConfig,
        overrides: overridesCopy,
      };
    }

    const override = createFreshOverride(displayName);

    return {
      ...fieldConfig,
      overrides: [override, ...overridesCopy],
    };
  }

  const override = createExtendedOverride(current, displayName);

  return {
    ...fieldConfig,
    overrides: [override, ...overridesCopy],
  };
};

const createFreshOverride = (displayName: string): SystemConfigOverrideRule => {
  return {
    __systemRef: displayOverrideRef,
    matcher: {
      id: FieldMatcherID.byRegexpReadonly,
      options: `^(?!${displayName}$).*$`,
    },
    properties: [
      {
        id: 'custom.hideFrom',
        value: {
          graph: true,
          legend: false,
          tooltip: false,
        },
      },
    ],
  };
};

const createExtendedOverride = (current: SystemConfigOverrideRule, displayName: string): SystemConfigOverrideRule => {
  const property = current.properties.find(p => p.id === 'custom.hideFrom') ?? {
    id: 'custom.hideFrom',
    value: {
      graph: true,
      legend: false,
      tooltip: false,
    },
  };

  const existing = matchersInConfig(current);
  const index = existing.findIndex(name => name === displayName);

  if (index < 0) {
    existing.push(displayName);
  } else {
    existing.splice(index, 1);
  }

  return {
    __systemRef: displayOverrideRef,
    matcher: {
      id: FieldMatcherID.byRegexpReadonly,
      options: `^(?!${existing.join('|')}$).*$`,
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

const matchersInConfig = (current: SystemConfigOverrideRule): string[] => {
  const match = /^\^\(\?\!([\w|-]+)\$\)\.\*\$$/.exec(current.matcher.options);

  if (match?.length === 2) {
    return match[1].split('|');
  }

  return [];
};
