import {
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
  fieldConfig: FieldConfigSource<any>
): FieldConfigSource<any> => {
  const { field, frame, data, mode } = event;
  const { overrides } = fieldConfig;

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

const createExtendedOverride = (current: SystemConfigOverrideRule, displayName: string): SystemConfigOverrideRule => {
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
    __systemRef: displayOverrideRef,
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

const combinedMatcher = (current: SystemConfigOverrideRule, displayName: string): string => {
  const match = /^\^\(\?\!([\w|-]+)\$\)\.\*\$$/.exec(current.matcher.options);

  if (match?.length === 2) {
    return `${displayName}|${match[1]}`;
  }

  return displayName;
};
