import { BusEventBase, BusEventWithPayload, EventBus, GrafanaTheme2, PanelModel, TimeRange } from '@grafana/data';

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

// Internal singleton instance
let singletonInstance: EventBus;

/**
 * Used during startup by Grafana to set the setAppEvents so it is available
 * via the {@link setAppEvents} to the rest of the application.
 *
 * @internal
 */
export function setAppEvents(instance: EventBus) {
  singletonInstance = instance;
}

/**
 * Used to retrieve an event bus that manages application level events
 *
 * @public
 */
export function getAppEvents(): EventBus {
  return singletonInstance;
}
