import { BusEventBase } from '@grafana/data';

export class PersistedStateChangedEvent extends BusEventBase {
  static type = 'dashboard-persisted-state-changed';
}
