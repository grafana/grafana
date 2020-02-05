import { DataFrame, eventFactory, TimeRange } from '@grafana/data';
import { DashboardModel } from 'app/features/dashboard/state';
import { VariableIdentifier } from '../features/templating/state/actions';
import { VariableType } from '../features/templating/variable';

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

export interface DataSourceResponse<T> {
  data: T;
  readonly status: number;
  readonly statusText: string;
  readonly ok: boolean;
  readonly headers: Headers;
  readonly redirected: boolean;
  readonly type: ResponseType;
  readonly url: string;
  readonly request: any;
}

type DataSourceResponsePayload = DataSourceResponse<any>;

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
export const variableNameInStateUpdated = eventFactory<VariableIdentifier>('variable-name-in-state-updated');
export interface MoveVariableType {
  name: string;
  label: string;
  index: number;
  type: VariableType;
}
export const variableTypeInAngularUpdated = eventFactory<MoveVariableType>('variable-type-in-angular-updated');
export interface VariableMovedToState {
  uuid: string;
  index: number;
}
export const variableMovedToState = eventFactory<VariableMovedToState>('variable-moved-to-state');
export const variableMovedToAngular = eventFactory<MoveVariableType>('variable-moved-to-angular');
export const variableMovedToAngularSucceeded = eventFactory<MoveVariableType>('variable-moved-to-angular-succeeded');
export const variableEditorChangeMode = eventFactory<string>('variable-editor-change-mode');
export interface VariableDuplicateVariableStart {
  uuid: string;
  type: VariableType;
  variablesInAngular: number;
}
export const variableDuplicateVariableStart = eventFactory<VariableDuplicateVariableStart>(
  'variable-duplicate-variable-start'
);
export const variableDuplicateVariableSucceeded = eventFactory<{ uuid: string }>(
  'variable-duplicate-variable-succeeded'
);
export interface VariableRemoveVariable {
  uuid: string;
  type: VariableType;
}
export const variableRemoveVariableStart = eventFactory<VariableRemoveVariable>('variable-remove-variable-start');
export const variableRemoveVariableSucceeded = eventFactory<{ uuid: string }>('variable-remove-variable-succeeded');
export const variableRemoveVariableInAngularSucceeded = eventFactory<{ name: string }>(
  'variable-remove-variable-in-angular-succeeded'
);
export interface VariableChangeOrderStart {
  fromIndex: number;
  toIndex: number;
}
export const variableChangeOrderStart = eventFactory<VariableChangeOrderStart>('variable-change-order-start');
export const variableChangeOrderSucceeded = eventFactory('variable-change-order-succeeded');
export interface VariableNewVariableStart {
  variablesInAngular: number;
}
export const variableNewVariableStart = eventFactory<VariableNewVariableStart>('variable-new-variable-start');
export const variableNewVariableSucceeded = eventFactory('variable-new-variable-succeeded');
export const variableStoreNewVariableSucceeded = eventFactory<{ uuid: string }>(
  'variable-store-new-variable-succeeded'
);
export const submenuVisibilityChanged = eventFactory<boolean>('submenu-visibility-changed');

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
