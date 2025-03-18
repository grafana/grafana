import { FieldConfigSource as FieldConfigSourceV1, SpecialValueMatch as SpecialValueMatchV1 } from '@grafana/data';
import {
  VariableHide as VariableHideV1,
  VariableRefresh as VariableRefreshV1,
  VariableSort as VariableSortV1,
  DashboardCursorSync as DashboardCursorSyncV1,
  defaultDashboardCursorSync,
  MappingType as MappingTypeV1,
  ThresholdsMode as ThresholdsModeV1,
} from '@grafana/schema';
import {
  DashboardCursorSync,
  VariableHide,
  VariableRefresh,
  VariableSort,
  FieldConfigSource,
  SpecialValueMatch,
  ThresholdsMode,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';

export function transformVariableRefreshToEnumV1(refresh?: VariableRefresh): VariableRefreshV1 {
  switch (refresh) {
    case 'never':
      return VariableRefreshV1.never;
    case 'onDashboardLoad':
      return VariableRefreshV1.onDashboardLoad;
    case 'onTimeRangeChanged':
      return VariableRefreshV1.onTimeRangeChanged;
    default:
      return VariableRefreshV1.never;
  }
}

export function transformVariableHideToEnumV1(hide?: VariableHide): VariableHideV1 {
  switch (hide) {
    case 'dontHide':
      return VariableHideV1.dontHide;
    case 'hideLabel':
      return VariableHideV1.hideLabel;
    case 'hideVariable':
      return VariableHideV1.hideVariable;
    default:
      return VariableHideV1.dontHide;
  }
}

export function transformSortVariableToEnumV1(sort?: VariableSort): VariableSortV1 {
  switch (sort) {
    case 'disabled':
      return VariableSortV1.disabled;
    case 'numericalAsc':
      return VariableSortV1.numericalAsc;
    case 'alphabeticalCaseInsensitiveAsc':
      return VariableSortV1.alphabeticalCaseInsensitiveAsc;
    case 'alphabeticalCaseInsensitiveDesc':
      return VariableSortV1.alphabeticalCaseInsensitiveDesc;
    case 'numericalDesc':
      return VariableSortV1.numericalDesc;
    case 'naturalAsc':
      return VariableSortV1.naturalAsc;
    case 'naturalDesc':
      return VariableSortV1.naturalDesc;
    case 'alphabeticalAsc':
      return VariableSortV1.alphabeticalAsc;
    case 'alphabeticalDesc':
      return VariableSortV1.alphabeticalDesc;
    default:
      return VariableSortV1.disabled;
  }
}

export function transformCursorSyncV2ToV1(cursorSync: DashboardCursorSync): DashboardCursorSyncV1 {
  switch (cursorSync) {
    case 'Crosshair':
      return DashboardCursorSyncV1.Crosshair;
    case 'Tooltip':
      return DashboardCursorSyncV1.Tooltip;
    case 'Off':
      return DashboardCursorSyncV1.Off;
    default:
      return defaultDashboardCursorSync;
  }
}

function transformSpecialValueMatchToV1(match: SpecialValueMatch): SpecialValueMatchV1 {
  switch (match) {
    case 'true':
      return SpecialValueMatchV1.True;
    case 'false':
      return SpecialValueMatchV1.False;
    case 'null':
      return SpecialValueMatchV1.Null;
    case 'nan':
      return SpecialValueMatchV1.NaN;
    case 'null+nan':
      return SpecialValueMatchV1.NullAndNaN;
    case 'empty':
      return SpecialValueMatchV1.Empty;
    default:
      throw new Error(`Unknown match type: ${match}`);
  }
}

export function transformMappingsToV1(fieldConfig: FieldConfigSource): FieldConfigSourceV1 {
  const getThresholdsMode = (mode: ThresholdsMode): ThresholdsModeV1 => {
    switch (mode) {
      case 'absolute':
        return ThresholdsModeV1.Absolute;
      case 'percentage':
        return ThresholdsModeV1.Percentage;
      default:
        return ThresholdsModeV1.Absolute;
    }
  };

  const transformedDefaults: any = {
    ...fieldConfig.defaults,
  };

  if (fieldConfig.defaults.mappings) {
    transformedDefaults.mappings = fieldConfig.defaults.mappings.map((mapping) => {
      switch (mapping.type) {
        case 'value':
          return {
            ...mapping,
            type: MappingTypeV1.ValueToText,
          };
        case 'range':
          return {
            ...mapping,
            type: MappingTypeV1.RangeToText,
          };
        case 'regex':
          return {
            ...mapping,
            type: MappingTypeV1.RegexToText,
          };
        case 'special':
          return {
            ...mapping,
            options: {
              ...mapping.options,
              match: transformSpecialValueMatchToV1(mapping.options.match),
            },
            type: MappingTypeV1.SpecialValue,
          };
        default:
          return mapping;
      }
    });
  }

  if (fieldConfig.defaults.thresholds) {
    transformedDefaults.thresholds = {
      ...fieldConfig.defaults.thresholds,
      mode: getThresholdsMode(fieldConfig.defaults.thresholds.mode),
    };
  }

  return {
    ...fieldConfig,
    defaults: transformedDefaults,
  };
}
