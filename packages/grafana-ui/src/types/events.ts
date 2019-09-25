import { eventFactory } from '@grafana/data';
import { DataQueryResponseData, DataQueryError } from '.';

export const dataReceived = eventFactory<DataQueryResponseData[]>('data-received');
export const dataError = eventFactory<DataQueryError>('data-error');
export const dataSnapshotLoad = eventFactory<DataQueryResponseData[]>('data-snapshot-load');
