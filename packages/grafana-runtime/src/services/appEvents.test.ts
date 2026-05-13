import { BusEventBase, EventBusSrv, type BusEvent, type BusEventType } from '@grafana/data';

import { __resetLegacyDashboardApiUsageDedupeForTests } from '../analytics/legacyDashboardApiUsage';
import * as legacyApiUsageModule from '../analytics/legacyDashboardApiUsage';

import { CopyPanelEvent, RefreshEvent, TimeRangeUpdatedEvent, getAppEvents, setAppEvents } from './appEvents';

class UnrelatedEvent extends BusEventBase {
  static type = 'unrelated';
}

describe('appEvents legacy subscription telemetry', () => {
  let reportSpy: jest.SpyInstance;

  beforeEach(() => {
    __resetLegacyDashboardApiUsageDedupeForTests();
    reportSpy = jest.spyOn(legacyApiUsageModule, 'reportLegacyDashboardApiUsage').mockImplementation(() => {});
    setAppEvents(new EventBusSrv());
  });

  afterEach(() => {
    reportSpy.mockRestore();
  });

  it.each([
    [RefreshEvent, 'RefreshEvent.subscribe'],
    [TimeRangeUpdatedEvent, 'TimeRangeUpdatedEvent.subscribe'],
    [CopyPanelEvent, 'CopyPanelEvent.subscribe'],
  ])('reports legacy subscription via .subscribe()', (EventType, apiName) => {
    getAppEvents().subscribe(EventType as BusEventType<BusEvent>, () => {});
    expect(reportSpy).toHaveBeenCalledWith(expect.objectContaining({ apiName }));
  });

  it.each([
    [RefreshEvent, 'RefreshEvent.subscribe'],
    [TimeRangeUpdatedEvent, 'TimeRangeUpdatedEvent.subscribe'],
    [CopyPanelEvent, 'CopyPanelEvent.subscribe'],
  ])('reports legacy subscription via .getStream()', (EventType, apiName) => {
    getAppEvents()
      .getStream(EventType as BusEventType<BusEvent>)
      .subscribe(() => {});
    expect(reportSpy).toHaveBeenCalledWith(expect.objectContaining({ apiName }));
  });

  it('does NOT report non-legacy events', () => {
    getAppEvents().subscribe(UnrelatedEvent, () => {});
    expect(reportSpy).not.toHaveBeenCalled();
  });

  it('still delivers events to the subscribed handler', () => {
    const handler = jest.fn();
    getAppEvents().subscribe(RefreshEvent, handler);
    getAppEvents().publish(new RefreshEvent());
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
