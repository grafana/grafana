import { SelectableValue } from '@grafana/data';
import { Messages } from '../AddRemoteInstance.messages';
import { TrackingOptions } from '../AddRemoteInstance.types';
import { MetricsParameters, Schema } from './FormParts.types';

export const trackingOptions = [
  { value: TrackingOptions.none, label: Messages.form.trackingOptions.none },
  { value: TrackingOptions.pgStatements, label: Messages.form.trackingOptions.pgStatements },
  { value: TrackingOptions.pgMonitor, label: Messages.form.trackingOptions.pgMonitor },
];

export const rdsTrackingOptions = [
  { value: TrackingOptions.none, label: Messages.form.trackingOptions.none },
  { value: TrackingOptions.pgStatements, label: Messages.form.trackingOptions.pgStatements },
];

export const schemaOptions: SelectableValue[] = [
  { value: Schema.HTTPS, label: Messages.form.schemaOptions.https },
  { value: Schema.HTTP, label: Messages.form.schemaOptions.http },
];

export const metricsParametersOptions: SelectableValue[] = [
  { value: MetricsParameters.manually, label: Messages.form.metricsParametersOptions.manually },
  { value: MetricsParameters.parsed, label: Messages.form.metricsParametersOptions.parsed },
];
