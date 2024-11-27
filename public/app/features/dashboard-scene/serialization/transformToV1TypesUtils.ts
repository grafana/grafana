import { FieldConfigSource as FieldConfigSourceV1, SpecialValueMatch as SpecialValueMatchV1 } from '@grafana/data';
import {
  VariableHide as VariableHideV1,
  VariableRefresh as VariableRefreshV1,
  VariableSort as VariableSortV1,
  DashboardCursorSync as DashboardCursorSyncV1,
  defaultDashboardCursorSync,
} from '@grafana/schema';
import {
  DashboardCursorSync,
  MappingType,
  VariableHide,
  VariableRefresh,
  VariableSort,
  FieldConfigSource,
  SpecialValueMatch,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';

export function transformVariableRefreshToEnumV1(refresh?: VariableRefresh): VariableRefreshV1 {
  switch (refresh) {
    case VariableRefresh.Never:
      return VariableRefreshV1.never;
    case VariableRefresh.OnDashboardLoad:
      return VariableRefreshV1.onDashboardLoad;
    case VariableRefresh.OnTimeRangeChanged:
      return VariableRefreshV1.onTimeRangeChanged;
    default:
      return VariableRefreshV1.never;
  }
}

export function transformVariableHideToEnumV1(hide?: VariableHide): VariableHideV1 {
  switch (hide) {
    case VariableHide.DontHide:
      return VariableHideV1.dontHide;
    case VariableHide.HideLabel:
      return VariableHideV1.hideLabel;
    case VariableHide.HideVariable:
      return VariableHideV1.hideVariable;
    default:
      return VariableHideV1.dontHide;
  }
}

export function transformSortVariableToEnumV1(sort?: VariableSort): VariableSortV1 {
  switch (sort) {
    case VariableSort.Disabled:
      return VariableSortV1.disabled;
    case VariableSort.NumericalAsc:
      return VariableSortV1.numericalAsc;
    case VariableSort.NumericalDesc:
      return VariableSortV1.numericalDesc;
    case VariableSort.AlphabeticalAsc:
      return VariableSortV1.alphabeticalAsc;
    case VariableSort.AlphabeticalDesc:
      return VariableSortV1.alphabeticalDesc;
    default:
      return VariableSortV1.disabled;
  }
}

export function transformCursorSyncV2ToV1(cursorSync: DashboardCursorSync): DashboardCursorSyncV1 {
  switch (cursorSync) {
    case DashboardCursorSync.Crosshair:
      return DashboardCursorSyncV1.Crosshair;
    case DashboardCursorSync.Tooltip:
      return DashboardCursorSyncV1.Tooltip;
    case DashboardCursorSync.Off:
      return DashboardCursorSyncV1.Off;
    default:
      return defaultDashboardCursorSync;
  }
}

function transformSpecialValueMatchToV1(match: SpecialValueMatch): SpecialValueMatchV1 {
  switch (match) {
    case SpecialValueMatch.True:
      return SpecialValueMatchV1.True;
    case SpecialValueMatch.False:
      return SpecialValueMatchV1.False;
    case SpecialValueMatch.Null:
      return SpecialValueMatchV1.Null;
    case SpecialValueMatch.NotANumber:
      return SpecialValueMatchV1.NaN;
    case SpecialValueMatch.NullAndNaN:
      return SpecialValueMatchV1.NullAndNaN;
    case SpecialValueMatch.Empty:
      return SpecialValueMatchV1.Empty;
    default:
      throw new Error(`Unknown match type: ${match}`);
  }
}

export function transformValueMappingsToV1(fieldConfig: FieldConfigSource): FieldConfigSourceV1 {
  return {
    ...fieldConfig,
    defaults: {
      ...fieldConfig.defaults,
      mappings: fieldConfig.defaults.mappings?.map((mapping) => {
        switch (mapping.type) {
          case 'value':
            return {
              ...mapping,
              type: MappingType.ValueToText,
            };
          case 'range':
            return {
              ...mapping,
              type: MappingType.RangeToText,
            };
          case 'regex':
            return {
              ...mapping,
              type: MappingType.RegexToText,
            };
          case 'special':
            return {
              ...mapping,
              options: {
                ...mapping.options,
                match: transformSpecialValueMatchToV1(mapping.options.match),
              },
              type: MappingType.SpecialValue,
            };
          default:
            return mapping;
        }
      }),
    },
  };
}
