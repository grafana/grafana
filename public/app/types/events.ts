import { AnnotationQuery, BusEventBase, BusEventWithPayload, eventFactory } from '@grafana/data';
import { IconName, ButtonVariant } from '@grafana/ui';
import { HistoryEntryView } from 'app/core/components/AppChrome/types';

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

export interface ShowModalReactPayload {
  component: React.ComponentType<any>;
  props?: any;
}

export interface OpenExtensionSidebarPayload {
  props?: Record<string, unknown>;
  pluginId: string;
  componentTitle: string;
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
  icon?: IconName;
  yesButtonVariant?: ButtonVariant;

  onDismiss?: () => void;
  onConfirm?: () => void;
  onAltAction?: () => void;
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
  handleIndex: number;
}

export interface DashScrollPayload {
  restore?: boolean;
  animate?: boolean;
  pos?: number;
}

export interface PanelChangeViewPayload {}

/**
 * Events
 */

export const templateVariableValueUpdated = eventFactory('template-variable-value-updated');
export const graphClicked = eventFactory<GraphClickedPayload>('graph-click');

/**
 * @internal
 */
export const thresholdChanged = eventFactory<ThresholdChangedPayload>('threshold-changed');

/**
 * Used for syncing queries badge count in panel edit queries tab
 * Think we can get rid of this soon
 */
export class PanelQueriesChangedEvent extends BusEventBase {
  static type = 'panel-queries-changed';
}

/**
 * Used for syncing transformations badge count in panel edit transform tab
 * Think we can get rid of this soon
 */
export class PanelTransformationsChangedEvent extends BusEventBase {
  static type = 'panel-transformations-changed';
}

/**
 * Used by panel editor to know when panel plugin itself trigger option updates
 */
export class PanelOptionsChangedEvent extends BusEventBase {
  static type = 'panels-options-changed';
}

/**
 * Used internally by DashboardModel to communicate with DashboardGrid that it needs to re-render
 */
export class DashboardPanelsChangedEvent extends BusEventBase {
  static type = 'dashboard-panels-changed';
}

export class DashboardMetaChangedEvent extends BusEventBase {
  static type = 'dashboard-meta-changed';
}

export class PanelDirectiveReadyEvent extends BusEventBase {
  static type = 'panel-directive-ready';
}

export class RenderEvent extends BusEventBase {
  static type = 'render';
}

interface ZoomOutEventPayload {
  scale: number;
  updateUrl?: boolean;
}

export class ZoomOutEvent extends BusEventWithPayload<ZoomOutEventPayload> {
  static type = 'zoom-out';
}

export enum ShiftTimeEventDirection {
  Left = -1,
  Right = 1,
}

interface ShiftTimeEventPayload {
  direction: ShiftTimeEventDirection;
  updateUrl?: boolean;
}

export class ShiftTimeEvent extends BusEventWithPayload<ShiftTimeEventPayload> {
  static type = 'shift-time';
}

export class CopyTimeEvent extends BusEventBase {
  static type = 'copy-time';
}

interface PasteTimeEventPayload {
  updateUrl?: boolean;
}

export class PasteTimeEvent extends BusEventWithPayload<PasteTimeEventPayload> {
  static type = 'paste-time';
}

interface AbsoluteTimeEventPayload {
  updateUrl: boolean;
}

export class AbsoluteTimeEvent extends BusEventWithPayload<AbsoluteTimeEventPayload> {
  static type = 'absolute-time';
}

export class RemovePanelEvent extends BusEventWithPayload<number> {
  static type = 'remove-panel';
}

/**
 * @deprecated use ShowModalReactEvent instead that has this capability built in
 */
export class ShowModalEvent extends BusEventWithPayload<ShowModalPayload> {
  static type = 'show-modal';
}

export class ShowConfirmModalEvent extends BusEventWithPayload<ShowConfirmModalPayload> {
  static type = 'show-confirm-modal';
}

export class ShowModalReactEvent extends BusEventWithPayload<ShowModalReactPayload> {
  static type = 'show-react-modal';
}

export class OpenExtensionSidebarEvent extends BusEventWithPayload<OpenExtensionSidebarPayload> {
  static type = 'open-extension-sidebar';
}

export class CloseExtensionSidebarEvent extends BusEventBase {
  static type = 'close-extension-sidebar';
}

/**
 * @deprecated use ShowModalReactEvent instead that has this capability built in
 */
export class HideModalEvent extends BusEventBase {
  static type = 'hide-modal';
}

export class DashboardSavedEvent extends BusEventBase {
  static type = 'dashboard-saved';
}

export class AnnotationQueryStarted extends BusEventWithPayload<AnnotationQuery> {
  static type = 'annotation-query-started';
}

export class AnnotationQueryFinished extends BusEventWithPayload<AnnotationQuery> {
  static type = 'annotation-query-finished';
}

export class PanelEditEnteredEvent extends BusEventWithPayload<number> {
  static type = 'panel-edit-started';
}

export class PanelEditExitedEvent extends BusEventWithPayload<number> {
  static type = 'panel-edit-finished';
}

export class RecordHistoryEntryEvent extends BusEventWithPayload<HistoryEntryView> {
  static type = 'record-history-entry';
}
