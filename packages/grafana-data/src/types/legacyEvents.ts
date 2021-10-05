import { DataQueryError, DataQueryResponseData } from './datasource';
import { AngularPanelMenuItem } from './panel';
import { DataFrame } from './dataFrame';
import { eventFactory } from '../events/eventFactory';
import { BusEventBase, BusEventWithPayload } from '../events/types';
import { DataHoverPayload } from '../events';

export type AlertPayload = [string, string?];
export type AlertErrorPayload = [string, (string | Error)?];

export const AppEvents = {
  alertSuccess: eventFactory<AlertPayload>('alert-success'),
  alertWarning: eventFactory<AlertPayload>('alert-warning'),
  alertError: eventFactory<AlertErrorPayload>('alert-error'),
};

export const PanelEvents = {
  refresh: eventFactory('refresh'),
  componentDidMount: eventFactory('component-did-mount'),
  dataReceived: eventFactory<DataQueryResponseData[]>('data-received'),
  dataError: eventFactory<DataQueryError>('data-error'),
  dataFramesReceived: eventFactory<DataFrame[]>('data-frames-received'),
  dataSnapshotLoad: eventFactory<DataQueryResponseData[]>('data-snapshot-load'),
  editModeInitialized: eventFactory('init-edit-mode'),
  initPanelActions: eventFactory<AngularPanelMenuItem[]>('init-panel-actions'),
  initialized: eventFactory('panel-initialized'),
  panelTeardown: eventFactory('panel-teardown'),
  render: eventFactory<any>('render'),
};

/**
 * @deprecated It will be removed with the old graph. For setting cursor on GraphNG please check GraphNG/events.
 */
export interface LegacyGraphHoverEventPayload extends DataHoverPayload {
  pos: any;
  panel: {
    id: number;
  };
}

/**
 * @deprecated It will be removed with the old graph. For setting cursor on GraphNG please check GraphNG/events.
 */
export class LegacyGraphHoverEvent extends BusEventWithPayload<LegacyGraphHoverEventPayload> {
  static type = 'graph-hover';
}

/**
 * @deprecated It will be removed with the old graph. For setting cursor on GraphNG please check GraphNG/events.
 */
export class LegacyGraphHoverClearEvent extends BusEventBase {
  static type = 'graph-hover-clear';
  payload: DataHoverPayload = { point: {} };
}
