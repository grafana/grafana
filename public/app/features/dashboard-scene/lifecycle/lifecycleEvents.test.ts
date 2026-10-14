import { DashboardLifecycleChangedEvent } from './lifecycleEvents';

describe('DashboardLifecycleChangedEvent', () => {
  // Grafana Assistant subscribes by this type string, so it must not change.
  it('keeps the type plugins subscribe to', () => {
    const event = new DashboardLifecycleChangedEvent({ uid: 'abc', change: 'published' });

    expect(DashboardLifecycleChangedEvent.type).toBe('dashboard-lifecycle-changed');
    expect(event.payload).toEqual({ uid: 'abc', change: 'published' });
  });
});
