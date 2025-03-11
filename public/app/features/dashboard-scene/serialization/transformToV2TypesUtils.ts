import {
  VariableHide as VariableHideV1,
  VariableRefresh as VariableRefreshV1,
  VariableSort as VariableSortV1,
  DashboardCursorSync as DashboardCursorSyncV1,
  FieldColorModeId as FieldColorModeIdV1,
  DataTopic,
} from '@grafana/schema';
import { DataTransformerConfig } from '@grafana/schema/dist/esm/raw/dashboard/x/dashboard_types.gen';
import {
  DashboardCursorSync,
  defaultDashboardV2Spec,
  defaultVariableHide,
  defaultVariableRefresh,
  defaultVariableSort,
  VariableHide,
  VariableRefresh,
  VariableSort,
  FieldColorModeId as FieldColorModeIdV2,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';

// used for QueryVariableKind's query prop - in schema V2 we've deprecated string type and support only DataQuery
export const LEGACY_STRING_VALUE_KEY = '__legacyStringValue';

export function transformCursorSynctoEnum(cursorSync?: DashboardCursorSyncV1): DashboardCursorSync {
  switch (cursorSync) {
    case 0:
      return 'Off';
    case 1:
      return 'Crosshair';
    case 2:
      return 'Tooltip';
    default:
      return defaultDashboardV2Spec().cursorSync;
  }
}

export function transformVariableRefreshToEnum(refresh?: VariableRefreshV1): VariableRefresh {
  switch (refresh) {
    case 0:
      return 'never';
    case 1:
      return 'onDashboardLoad';
    case 2:
      return 'onTimeRangeChanged';
    default:
      return defaultVariableRefresh();
  }
}
export function transformVariableHideToEnum(hide?: VariableHideV1): VariableHide {
  switch (hide) {
    case 0:
      return 'dontHide';
    case 1:
      return 'hideLabel';
    case 2:
      return 'hideVariable';
    default:
      return defaultVariableHide();
  }
}
export function transformSortVariableToEnum(sort?: VariableSortV1): VariableSort {
  switch (sort) {
    case 0:
      return 'disabled';
    case 1:
      return 'alphabeticalAsc';
    case 2:
      return 'alphabeticalDesc';
    case 3:
      return 'numericalAsc';
    case 4:
      return 'numericalDesc';
    default:
      return defaultVariableSort();
  }
}

export function transformDataTopic(topic: DataTransformerConfig['topic']): DataTopic | undefined {
  switch (topic) {
    case 'annotations':
      return DataTopic.Annotations;
    case 'alertStates':
      return DataTopic.AlertStates;
    case 'series':
      return DataTopic.Series;
    default:
      return undefined;
  }
}

export function colorIdEnumToColorIdV2(colorId: FieldColorModeIdV1 | string): FieldColorModeIdV2 | undefined {
  switch (colorId) {
    case FieldColorModeIdV1.Thresholds:
      return 'thresholds';
    case FieldColorModeIdV1.PaletteClassic:
      return 'palette-classic';
    case FieldColorModeIdV1.PaletteClassicByName:
      return 'palette-classic-by-name';
    case FieldColorModeIdV1.ContinuousGrYlRd:
      return 'continuous-GrYlRd';
    case FieldColorModeIdV1.ContinuousRdYlGr:
      return 'continuous-RdYlGr';
    case FieldColorModeIdV1.ContinuousBlYlRd:
      return 'continuous-BlYlRd';
    case FieldColorModeIdV1.ContinuousYlRd:
      return 'continuous-YlRd';
    case FieldColorModeIdV1.ContinuousBlPu:
      return 'continuous-BlPu';
    case FieldColorModeIdV1.ContinuousYlBl:
      return 'continuous-YlBl';
    case FieldColorModeIdV1.ContinuousBlues:
      return 'continuous-blues';
    case FieldColorModeIdV1.ContinuousReds:
      return 'continuous-reds';
    case FieldColorModeIdV1.ContinuousGreens:
      return 'continuous-greens';
    case FieldColorModeIdV1.ContinuousPurples:
      return 'continuous-purples';
    case FieldColorModeIdV1.Fixed:
      return 'fixed';
    case FieldColorModeIdV1.Shades:
      return 'shades';
    default:
      return undefined;
  }
}
