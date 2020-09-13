import { DataQueryError, DataQueryResponseData } from '../types/datasource';
import { AngularPanelMenuItem } from '../types/panel';
import { DataFrame } from '../types/dataFrame';
import { AppEvent } from './types';

export type AlertPayload = [string, string?];
export type AlertErrorPayload = [string, (string | Error)?];

const typeList: Set<string> = new Set();

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
  panelInitialized: eventFactory('panel-initialized'),
  panelSizeChanged: eventFactory('panel-size-changed'),
  panelTeardown: eventFactory('panel-teardown'),
  render: eventFactory<any>('render'),
};

export function eventFactory<T = undefined>(name: string): AppEvent<T> {
  if (typeList.has(name)) {
    throw new Error(`There is already an event defined with type '${name}'`);
  }

  typeList.add(name);
  return { name };
}
