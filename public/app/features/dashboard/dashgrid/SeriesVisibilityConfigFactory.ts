import {
  ByNamesMatcherMode,
  DynamicConfigValue,
  FieldConfigSource,
  FieldMatcherID,
  isSystemOverrideWithRef,
  SystemConfigOverrideRule,
} from '@grafana/data';

export function seriesVisibilityConfigFactory(label: string, mode: ByNamesMatcherMode, fieldConfig: FieldConfigSource) {
  const isHideSeriesOverride = isSystemOverrideWithRef(displayOverrideRef);
  const hideFromIndex = fieldConfig.overrides.findIndex(isHideSeriesOverride);
  if (hideFromIndex < 0) {
    const override = createOverride([label]);
    return { ...fieldConfig, overrides: [...fieldConfig.overrides, override] };
  } else {
    const overridesCopy = Array.from(fieldConfig.overrides);
    const [current] = overridesCopy.splice(hideFromIndex, 1) as SystemConfigOverrideRule[];
    const existing = getExistingDisplayNames(current);
    const index = existing.findIndex((name) => name === label);
    if (index < 0) {
      existing.push(label);
    } else {
      existing.splice(index, 1);
    }
    const override = createOverride(existing);
    return { ...fieldConfig, overrides: [...overridesCopy, override] };
  }
}

const displayOverrideRef = 'hideSeriesFrom';

function createOverride(names: string[], property?: DynamicConfigValue): SystemConfigOverrideRule {
  property = property ?? {
    id: 'custom.hideFrom',
    value: {
      viz: true,
      legend: false,
      tooltip: false,
    },
  };

  return {
    __systemRef: displayOverrideRef,
    matcher: {
      id: FieldMatcherID.byNames,
      options: {
        mode: ByNamesMatcherMode.include,
        names: names,
        readOnly: true,
      },
    },
    properties: [
      {
        ...property,
        value: {
          viz: true,
          legend: false,
          tooltip: false,
        },
      },
    ],
  };
}

const getExistingDisplayNames = (rule: SystemConfigOverrideRule): string[] => {
  const names = rule.matcher.options?.names;
  if (!Array.isArray(names)) {
    return [];
  }
  return names;
};
