import { IHttpResponse } from 'angular';
import { TimeRange } from './time';
import { DashboardModel } from 'app/features/dashboard/state';
import { DataFrame } from './dataFrame';

export type AlertPayload = [string, string?];

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

export interface PanelChangeViewPayload {
  fullscreen?: boolean;
  edit?: boolean;
  panelId?: number;
  toggle?: boolean;
}

export type RemovePanelPayload = number;

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

export interface MenuElement {
  text: string;
  click: string;
  role?: string;
  shortcut?: string;
}

export interface AppEvent<T> {
  readonly name: string;
  payload?: T;
}

export function eventFactory<T>(name: string): AppEvent<T> {
  return { name };
}

export function noPayloadEventFactory(name: string): AppEvent<undefined> {
  return { name };
}

export const alertWarning = eventFactory<AlertPayload>('alert-warning');
export const alertSuccess = eventFactory<AlertPayload>('alert-success');
export const alertError = eventFactory<AlertPayload>('alert-error');

export const showDashSearch = eventFactory<ShowDashSearchPayload>('show-dash-search');
export const hideDashSearch = noPayloadEventFactory('hide-dash-search');
export const hideDashEditor = noPayloadEventFactory('hide-dash-editor');
export const dashScroll = eventFactory<DashScrollPayload>('dash-scroll');
export const dashLinksUpdated = noPayloadEventFactory('dash-links-updated');
export const saveDashboard = eventFactory<SaveDashboardPayload>('save-dashboard');
export const dashboardSaved = eventFactory<DashboardModel>('dashboard-saved');
export const searchQuery = noPayloadEventFactory('search-query');

export const locationChange = eventFactory<LocationChangePayload>('location-change');

export const timepickerOpen = noPayloadEventFactory('timepickerOpen');
export const timepickerClosed = noPayloadEventFactory('timepickerClosed');

export const showModal = eventFactory<ShowModalPayload>('show-modal');
export const showConfirmModal = eventFactory<ShowConfirmModalPayload>('confirm-modal');
export const hideModal = noPayloadEventFactory('hide-modal');

export const dsRequestResponse = eventFactory<DataSourceResponsePayload>('ds-request-response');
export const dsRequestError = eventFactory<DataSourceResponsePayload>('ds-request-error');

export const graphHover = eventFactory<GraphHoverPayload>('graph-hover');
export const graphHoverClear = noPayloadEventFactory('graph-hover-clear');

export const toggleSidemenuMobile = noPayloadEventFactory('toggle-sidemenu-mobile');
export const toggleSidemenuHidden = noPayloadEventFactory('toggle-sidemenu-hidden');

export const playlistStarted = noPayloadEventFactory('playlist-started');
export const playlistStopped = noPayloadEventFactory('playlist-stopped');

export const toggleKioskMode = eventFactory<ToggleKioskModePayload>('toggle-kiosk-mode');
export const toggleViewMode = noPayloadEventFactory('toggle-view-mode');

export const timeRangeUpdated = eventFactory<TimeRange>('time-range-updated');

export const repeatsProcessed = noPayloadEventFactory('repeats-processed');
export const rowExpanded = noPayloadEventFactory('row-expanded');
export const rowCollapsed = noPayloadEventFactory('row-collapsed');
export const templateVariableValueUpdated = noPayloadEventFactory('template-variable-value-updated');

export const panelSizeChanged = noPayloadEventFactory('panel-size-changed');
export const panelInitialized = noPayloadEventFactory('panel-initialized');
export const panelTeardown = noPayloadEventFactory('panel-teardown');
export const panelChangeView = eventFactory<PanelChangeViewPayload>('panel-change-view');
export const removePanel = eventFactory<RemovePanelPayload>('remove-panel');
export const initPanelActions = eventFactory<MenuElement[]>('init-panel-actions');

export const editModeInitialized = noPayloadEventFactory('init-edit-mode');
export const clientRefreshed = noPayloadEventFactory('refresh');

export const dataFramesReceived = eventFactory<DataFrame[]>('data-frames-received');

export const componentDidMount = noPayloadEventFactory('component-did-mount');

export const graphClicked = eventFactory<GraphClickedPayload>('graph-click');

export const thresholdChanged = eventFactory<ThresholdChangedPayload>('threshold-changed');

export const zoomOut = eventFactory<number>('zoom-out');

export const elasticQueryUpdated = noPayloadEventFactory('elastic-query-updated');

export const layoutModeChanged = eventFactory<string>('layout-mode-changed');

export const jsonDiffReady = noPayloadEventFactory('json-diff-ready');

export const closeTimepicker = noPayloadEventFactory('closeTimepicker');

export const routeUpdated = noPayloadEventFactory('$routeUpdate');
