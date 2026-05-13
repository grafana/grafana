import { BusEventBase, EventBusSrv, type BusEvent, type BusEventType } from '@grafana/data';

import { __resetLegacyDashboardApiUsageDedupeForTests } from '../analytics/legacyDashboardApiUsage';

import { CopyPanelEvent, RefreshEvent, TimeRangeUpdatedEvent, getAppEvents, setAppEvents } from './appEvents';

class UnrelatedEvent extends BusEventBase {
  static type = 'unrelated';
}

describe('appEvents legacy subscription telemetry', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    __resetLegacyDashboardApiUsageDedupeForTests();
    setAppEvents(new EventBusSrv());
    // Intercept console.warn so the real reportLegacyDashboardApiUsage can run
    // without failing the test via jest-fail-on-console
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it.each([
    [RefreshEvent, 'RefreshEvent.subscribe'],
    [TimeRangeUpdatedEvent, 'TimeRangeUpdatedEvent.subscribe'],
    [CopyPanelEvent, 'CopyPanelEvent.subscribe'],
  ])('reports legacy subscription via .subscribe()', (EventType, apiName) => {
    getAppEvents().subscribe(EventType as BusEventType<BusEvent>, () => {});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(apiName));
  });

  it.each([
    [RefreshEvent, 'RefreshEvent.getStream'],
    [TimeRangeUpdatedEvent, 'TimeRangeUpdatedEvent.getStream'],
    [CopyPanelEvent, 'CopyPanelEvent.getStream'],
  ])('reports legacy access via .getStream()', (EventType, apiName) => {
    getAppEvents()
      .getStream(EventType as BusEventType<BusEvent>)
      .subscribe(() => {});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(apiName));
  });

  it('does NOT report non-legacy events', () => {
    getAppEvents().subscribe(UnrelatedEvent, () => {});
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('still delivers events to the subscribed handler', () => {
    const handler = jest.fn();
    getAppEvents().subscribe(RefreshEvent, handler);
    getAppEvents().publish(new RefreshEvent());
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
