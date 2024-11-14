import {
  DashboardLink as OldDashboardLink,
  VariableHide as OldVariableHide,
  VariableRefresh as OldVariableRefresh,
  VariableSort as OldVariableSort,
} from '@grafana/schema';
import {
  DashboardCursorSync,
  defaultDashboardSpec,
  DashboardLinkType,
  DashboardLink,
  defaultVariableHide,
  defaultVariableRefresh,
  defaultVariableSort,
  VariableHide,
  VariableRefresh,
  VariableSort,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';

export function transformCursorSynctoEnum(cursorSync?: number): DashboardCursorSync {
  switch (cursorSync) {
    case 0:
      return DashboardCursorSync.Off;
    case 1:
      return DashboardCursorSync.Crosshair;
    case 2:
      return DashboardCursorSync.Tooltip;
    default:
      return defaultDashboardSpec().cursorSync;
  }
}

function transformDashboardLinkTypeToEnum(linkType: string): DashboardLinkType {
  switch (linkType) {
    case 'link':
      return DashboardLinkType.Link;
    case 'dashboard':
      return DashboardLinkType.Dashboards;
    default:
      return DashboardLinkType.Link;
  }
}

export function transformDashboardLinksToEnums(links: OldDashboardLink[]): DashboardLink[] {
  return links.map((link) => {
    return {
      ...link,
      type: transformDashboardLinkTypeToEnum(link.type),
    };
  });
}
export function transformVariableRefreshToEnum(refresh: OldVariableRefresh): VariableRefresh {
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
export function transformVariableHideToEnum(hide?: OldVariableHide): VariableHide {
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
export function transformSortVariableToEnum(sort?: OldVariableSort): VariableSort {
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
