import { DataFrame, TimeRange } from '@grafana/data';
import { IHttpResponse } from 'angular';
import { DashboardModel } from 'app/features/dashboard/state';
import { eventFactory } from '@grafana/data';

/**
 * Event Payloads
 */

export interface ShowDashSearchPayload {
  query?: string;
}

export interface LocationChangePayload {
  href: string;
}

export interface ShowModalPayload {
  model?: any;
  modalClass?: string;
  src?: string;
  templateHtml?: string;
  backdrop?: any;
  scope?: any;
}

export interface ShowConfirmModalPayload {
  title?: string;
  text?: string;
  text2?: string;
  text2htmlBind?: boolean;
  confirmText?: string;
  altActionText?: string;
  yesText?: string;
  noText?: string;
  icon?: string;

  onConfirm?: () => void;
  onAltAction?: () => void;
}

type DataSourceResponsePayload = IHttpResponse<any>;

export interface SaveDashboardPayload {
  overwrite?: boolean;
  folderId?: number;
  makeEditable?: boolean;
}

export interface GraphHoverPayload {
  pos: any;
  panel: {
    id: number;
  };
}

export interface ToggleKioskModePayload {
  exit?: boolean;
}

export interface GraphClickedPayload {
  pos: any;
  panel: any;
  item: any;
}

export interface ThresholdChangedPayload {
  threshold: any;
  handleIndex: any;
}

export interface DashScrollPayload {
  restore?: boolean;
  animate?: boolean;
  pos?: number;
}

/**
 * Events
 */

export const showDashSearch = eventFactory<ShowDashSearchPayload>('show-dash-search');
export const hideDashSearch = eventFactory('hide-dash-search');
export const hideDashEditor = eventFactory('hide-dash-editor');
export const dashScroll = eventFactory<DashScrollPayload>('dash-scroll');
export const dashLinksUpdated = eventFactory('dash-links-updated');
export const saveDashboard = eventFactory<SaveDashboardPayload>('save-dashboard');
export const dashboardFetchStart = eventFactory('dashboard-fetch-start');
export const dashboardSaved = eventFactory<DashboardModel>('dashboard-saved');
export const removePanel = eventFactory<number>('remove-panel');

export const searchQuery = eventFactory('search-query');

export const locationChange = eventFactory<LocationChangePayload>('location-change');

export const timepickerOpen = eventFactory('timepickerOpen');
export const timepickerClosed = eventFactory('timepickerClosed');

export const showModal = eventFactory<ShowModalPayload>('show-modal');
export const showConfirmModal = eventFactory<ShowConfirmModalPayload>('confirm-modal');
export const hideModal = eventFactory('hide-modal');

export const dsRequestResponse = eventFactory<DataSourceResponsePayload>('ds-request-response');
export const dsRequestError = eventFactory<any>('ds-request-error');

export const graphHover = eventFactory<GraphHoverPayload>('graph-hover');
export const graphHoverClear = eventFactory('graph-hover-clear');

export const toggleSidemenuMobile = eventFactory('toggle-sidemenu-mobile');
export const toggleSidemenuHidden = eventFactory('toggle-sidemenu-hidden');

export const playlistStarted = eventFactory('playlist-started');
export const playlistStopped = eventFactory('playlist-stopped');

export const toggleKioskMode = eventFactory<ToggleKioskModePayload>('toggle-kiosk-mode');
export const toggleViewMode = eventFactory('toggle-view-mode');

export const timeRangeUpdated = eventFactory<TimeRange>('time-range-updated');

export const repeatsProcessed = eventFactory('repeats-processed');
export const rowExpanded = eventFactory('row-expanded');
export const rowCollapsed = eventFactory('row-collapsed');
export const templateVariableValueUpdated = eventFactory('template-variable-value-updated');

export const dataFramesReceived = eventFactory<DataFrame[]>('data-frames-received');

export const graphClicked = eventFactory<GraphClickedPayload>('graph-click');

export const thresholdChanged = eventFactory<ThresholdChangedPayload>('threshold-changed');

export const zoomOut = eventFactory<number>('zoom-out');

export const shiftTime = eventFactory<number>('shift-time');

export const elasticQueryUpdated = eventFactory('elastic-query-updated');

export const layoutModeChanged = eventFactory<string>('layout-mode-changed');

export const jsonDiffReady = eventFactory('json-diff-ready');

export const closeTimepicker = eventFactory('closeTimepicker');

export const routeUpdated = eventFactory('$routeUpdate');
