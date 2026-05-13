import { type Observable, type Unsubscribable } from 'rxjs';

import {
  BusEventBase,
  BusEventWithPayload,
  resolvePluginIdFromStack,
  type BusEvent,
  type BusEventHandler,
  type BusEventType,
  type EventBus,
  type GrafanaTheme2,
  type PanelModel,
  type TimeRange,
} from '@grafana/data';

import * as legacyApiUsage from '../analytics/legacyDashboardApiUsage';

/**
 * Called when a dashboard is refreshed
 *
 * @public
 */
export class RefreshEvent extends BusEventBase {
  static type = 'refresh';
}

/**
 * Called when the theme settings change
 *
 * @public
 */
export class ThemeChangedEvent extends BusEventWithPayload<GrafanaTheme2> {
  static type = 'theme-changed';
}

/**
 * Called when time range is updated
 *
 * @public
 */
export class TimeRangeUpdatedEvent extends BusEventWithPayload<TimeRange> {
  static type = 'time-range-updated';
}

/**
 * Called to copy a panel JSON into local storage
 *
 * @public
 */
export class CopyPanelEvent extends BusEventWithPayload<PanelModel> {
  static type = 'copy-panel';
}

const LEGACY_EVENT_API_NAMES: Record<string, string> = {
  [RefreshEvent.type]: 'RefreshEvent.subscribe',
  [TimeRangeUpdatedEvent.type]: 'TimeRangeUpdatedEvent.subscribe',
  [CopyPanelEvent.type]: 'CopyPanelEvent.subscribe',
};

function reportIfLegacy(staticType: string | undefined): void {
  if (!staticType) {
    return;
  }
  const apiName = LEGACY_EVENT_API_NAMES[staticType];
  if (!apiName) {
    return;
  }
  legacyApiUsage.reportLegacyDashboardApiUsage({
    pluginId: resolvePluginIdFromStack(new Error().stack),
    apiName,
    extra: { eventType: staticType },
  });
}

function wrapBus(bus: EventBus): EventBus {
  return new Proxy(bus, {
    get(target, prop, receiver) {
      if (prop === 'subscribe') {
        return function <T extends BusEvent>(typeFilter: BusEventType<T>, handler: BusEventHandler<T>): Unsubscribable {
          reportIfLegacy(typeFilter?.type);
          return target.subscribe(typeFilter, handler);
        };
      }
      if (prop === 'getStream') {
        return function <T extends BusEvent>(eventType: BusEventType<T>): Observable<T> {
          reportIfLegacy(eventType?.type);
          return target.getStream(eventType);
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

// Internal singleton instance
let singletonInstance: EventBus;

/**
 * Used during startup by Grafana to set the singleton event bus.
 *
 * @internal
 */
export function setAppEvents(instance: EventBus) {
  singletonInstance = wrapBus(instance);
}

/**
 * Used to retrieve an event bus that manages application level events
 *
 * @public
 */
export function getAppEvents(): EventBus {
  return singletonInstance;
}
