import { SelectableValue } from '@grafana/data';
import { Messages } from '../AddRemoteInstance.messages';
import { TrackingOptions } from '../AddRemoteInstance.types';

export const trackingOptions = [
  { value: TrackingOptions.none, label: Messages.form.trackingOptions.none },
  { value: TrackingOptions.pgStatements, label: Messages.form.trackingOptions.pgStatements },
  { value: TrackingOptions.pgMonitor, label: Messages.form.trackingOptions.pgMonitor },
];

export const rdsTrackingOptions = [
  { key: TrackingOptions.none, value: Messages.form.trackingOptions.none },
  { key: TrackingOptions.pgStatements, value: Messages.form.trackingOptions.pgStatements },
];

export const schemaOptions: SelectableValue[] = [
  { value: 'https', label: 'HTTPS' },
  { value: 'http', label: 'HTTP' },
];
