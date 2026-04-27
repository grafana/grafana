import { EventBusSrv, type EventBusExtended } from '@grafana/data/events';

export const appEvents: EventBusExtended = new EventBusSrv();
