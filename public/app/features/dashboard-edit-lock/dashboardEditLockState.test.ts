import {
  acquireDashboardEditLock,
  getDashboardEditLocks,
  subscribeToDashboardEditLocks,
} from './dashboardEditLockState';

describe('dashboardEditLockState', () => {
  afterEach(() => {
    // Locks can only be released through their handles, so each test must
    // clean up after itself; fail loudly if one leaks into the next test.
    expect(getDashboardEditLocks()).toHaveLength(0);
  });

  it('shows a lock while acquired and removes it on release', () => {
    const handle = acquireDashboardEditLock({ label: 'Building your dashboard' });

    expect(getDashboardEditLocks()).toHaveLength(1);
    expect(getDashboardEditLocks()[0].label).toBe('Building your dashboard');

    handle.release();
    expect(getDashboardEditLocks()).toHaveLength(0);
  });

  it('is reentrant: the overlay condition holds until every lock is released', () => {
    const first = acquireDashboardEditLock({ label: 'first' });
    const second = acquireDashboardEditLock({ label: 'second' });

    expect(getDashboardEditLocks()).toHaveLength(2);
    // The most recent lock is last — it drives the pill.
    expect(getDashboardEditLocks()[1].label).toBe('second');

    first.release();
    expect(getDashboardEditLocks()).toHaveLength(1);
    expect(getDashboardEditLocks()[0].label).toBe('second');

    second.release();
    expect(getDashboardEditLocks()).toHaveLength(0);
  });

  it('release is idempotent', () => {
    const first = acquireDashboardEditLock({ label: 'first' });
    const second = acquireDashboardEditLock({ label: 'second' });

    first.release();
    first.release();

    expect(getDashboardEditLocks()).toHaveLength(1);
    expect(getDashboardEditLocks()[0].label).toBe('second');
    second.release();
  });

  it('updates the status of the owning lock only', () => {
    const first = acquireDashboardEditLock({ label: 'first' });
    const second = acquireDashboardEditLock({ label: 'second' });

    first.setStatus('adding panels');

    expect(getDashboardEditLocks()[0].status).toBe('adding panels');
    expect(getDashboardEditLocks()[1].status).toBeUndefined();

    first.release();
    second.release();
  });

  it('ignores setStatus after release', () => {
    const handle = acquireDashboardEditLock({ label: 'first' });
    handle.release();

    handle.setStatus('too late');
    expect(getDashboardEditLocks()).toHaveLength(0);
  });

  it('notifies subscribers on acquire, status change, and release', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToDashboardEditLocks(listener);

    const handle = acquireDashboardEditLock({ label: 'first' });
    handle.setStatus('working');
    handle.setStatus('working'); // unchanged status must not notify
    handle.release();
    handle.release(); // idempotent release must not notify

    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
  });
});
