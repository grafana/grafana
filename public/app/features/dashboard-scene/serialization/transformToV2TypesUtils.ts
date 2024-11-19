import {
  DashboardLink as DashboardLinkV1,
  VariableHide as VariableHideV1,
  VariableRefresh as VariableRefreshV1,
  VariableSort as VariableSortV1,
  DashboardCursorSync as DashboardCursorSyncV1,
  DashboardLinkType as DashboardLinkTypeV1,
} from '@grafana/schema';
import {
  DashboardCursorSync,
  defaultDashboardV2Spec,
  DashboardLinkType,
  DashboardLink,
  defaultVariableHide,
  defaultVariableRefresh,
  defaultVariableSort,
  VariableHide,
  VariableRefresh,
  VariableSort,
  defaultDashboardLinkType,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';

export function transformCursorSynctoEnum(cursorSync?: DashboardCursorSyncV1): DashboardCursorSync {
  switch (cursorSync) {
    case 0:
      return DashboardCursorSync.Off;
    case 1:
      return DashboardCursorSync.Crosshair;
    case 2:
      return DashboardCursorSync.Tooltip;
    default:
      return defaultDashboardV2Spec().cursorSync;
  }
}

function transformDashboardLinkTypeToEnum(linkType: DashboardLinkTypeV1): DashboardLinkType {
  switch (linkType) {
    case 'link':
      return DashboardLinkType.Link;
    case 'dashboards':
      return DashboardLinkType.Dashboards;
    default:
      return defaultDashboardLinkType();
  }
}

export function transformDashboardLinksToEnums(links: DashboardLinkV1[]): DashboardLink[] {
  return links.map((link) => {
    return {
      ...link,
      type: transformDashboardLinkTypeToEnum(link.type),
    };
  });
}
export function transformVariableRefreshToEnum(refresh?: VariableRefreshV1): VariableRefresh {
  switch (refresh) {
    case 0:
      return VariableRefresh.Never;
    case 1:
      return VariableRefresh.OnDashboardLoad;
    case 2:
      return VariableRefresh.OnTimeRangeChanged;
    default:
      return defaultVariableRefresh();
  }
}
export function transformVariableHideToEnum(hide?: VariableHideV1): VariableHide {
  switch (hide) {
    case 0:
      return VariableHide.DontHide;
    case 1:
      return VariableHide.HideLabel;
    case 2:
      return VariableHide.HideVariable;
    default:
      return defaultVariableHide();
  }
}
export function transformSortVariableToEnum(sort?: VariableSortV1): VariableSort {
  switch (sort) {
    case 0:
      return VariableSort.Disabled;
    case 1:
      return VariableSort.AlphabeticalAsc;
    case 2:
      return VariableSort.AlphabeticalDesc;
    case 3:
      return VariableSort.NumericalAsc;
    case 4:
      return VariableSort.NumericalDesc;
    default:
      return defaultVariableSort();
  }
}
