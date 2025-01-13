import {
  VariableHide as VariableHideV1,
  VariableRefresh as VariableRefreshV1,
  VariableSort as VariableSortV1,
  DashboardCursorSync as DashboardCursorSyncV1,
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
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';

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
