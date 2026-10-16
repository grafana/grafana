import {
  getEffectiveExtensionSidebarPresentation,
  resetExtensionSidebarPresentationForTests,
  setExtensionSidebarPresentation,
} from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarLayout';

import {
  addComposerEnterRequestListener,
  clearPendingComposerEnterRequest,
  PENDING_REQUEST_TTL_MS,
  requestComposerEnter,
  settleComposerEnterRequest,
  wasComposerEnterRequestDocked,
} from './composerEntryRequests';

// The Assistant's sidebar: the plugin that may float.
const sidebarPresentation = () => getEffectiveExtensionSidebarPresentation('grafana-assistant-app');

const TARGET = { resource: 'dashboard', uid: 'abc' } as const;

afterEach(() => {
  clearPendingComposerEnterRequest();
  resetExtensionSidebarPresentationForTests();
  jest.useRealTimers();
});

it('delivers to a listener that is already registered, immediately and once', () => {
  const first = jest.fn();
  const second = jest.fn();
  const unsubscribeFirst = addComposerEnterRequestListener(first);
  const unsubscribeSecond = addComposerEnterRequestListener(second);

  requestComposerEnter(TARGET);

  expect(first).toHaveBeenCalledWith(TARGET);
  expect(second).not.toHaveBeenCalled();
  unsubscribeFirst();
  unsubscribeSecond();
});

it('queues a request until the first listener subscribes, then delivers it once', () => {
  requestComposerEnter(TARGET);
  const listener = jest.fn();
  const unsubscribe = addComposerEnterRequestListener(listener);
  expect(listener).toHaveBeenCalledWith(TARGET);

  const later = jest.fn();
  const unsubscribeLater = addComposerEnterRequestListener(later);
  expect(later).not.toHaveBeenCalled();
  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
  unsubscribeLater();
});

it('drops a queued request after 10 seconds', () => {
  jest.useFakeTimers();
  requestComposerEnter(TARGET);
  jest.advanceTimersByTime(PENDING_REQUEST_TTL_MS + 1);

  const listener = jest.fn();
  const unsubscribe = addComposerEnterRequestListener(listener);
  expect(listener).not.toHaveBeenCalled();
  unsubscribe();
});

it('drops a queued request when cleared, as on navigation', () => {
  requestComposerEnter(TARGET);
  clearPendingComposerEnterRequest();

  const listener = jest.fn();
  const unsubscribe = addComposerEnterRequestListener(listener);
  expect(listener).not.toHaveBeenCalled();
  unsubscribe();
});

it('stops delivering to a listener once it unsubscribes', () => {
  const listener = jest.fn();
  addComposerEnterRequestListener(listener)();
  requestComposerEnter(TARGET);
  expect(listener).not.toHaveBeenCalled();
});

// grafana.extensionSidebarFloating is off here: a request floats the sidebar without it.
describe('a request that floats the sidebar', () => {
  it('floats the sidebar while it waits', () => {
    requestComposerEnter(TARGET, { float: true });
    expect(sidebarPresentation()).toBe('floating');
  });

  it('docks the sidebar again when no session starts within 10 seconds', () => {
    jest.useFakeTimers();
    requestComposerEnter(TARGET, { float: true });
    jest.advanceTimersByTime(PENDING_REQUEST_TTL_MS);
    expect(sidebarPresentation()).toBe('docked');
  });

  it('docks the sidebar again when the entry attempt settles without a session', () => {
    requestComposerEnter(TARGET, { float: true });
    settleComposerEnterRequest(TARGET.uid);
    expect(sidebarPresentation()).toBe('docked');
  });

  it('docks the sidebar again when the dashboard goes away first', () => {
    requestComposerEnter(TARGET, { float: true });
    clearPendingComposerEnterRequest();
    expect(sidebarPresentation()).toBe('docked');
  });

  it('keeps floating while the listener that took it enters Composer', () => {
    requestComposerEnter(TARGET, { float: true });
    const listener = jest.fn();
    const unsubscribe = addComposerEnterRequestListener(listener);
    expect(listener).toHaveBeenCalledWith(TARGET);
    expect(sidebarPresentation()).toBe('floating');
    unsubscribe();
  });

  it('ignores the settling of another dashboard', () => {
    requestComposerEnter(TARGET, { float: true });
    settleComposerEnterRequest('another-dashboard');
    expect(sidebarPresentation()).toBe('floating');
  });

  it('still goes ahead, docked, when the user docks the sidebar while it waits', () => {
    requestComposerEnter(TARGET, { float: true });
    expect(wasComposerEnterRequestDocked(TARGET.uid)).toBe(false);
    setExtensionSidebarPresentation('docked');
    expect(sidebarPresentation()).toBe('docked');
    expect(wasComposerEnterRequestDocked(TARGET.uid)).toBe(true);
    expect(wasComposerEnterRequestDocked('another-dashboard')).toBe(false);

    const listener = jest.fn();
    const unsubscribe = addComposerEnterRequestListener(listener);
    expect(listener).toHaveBeenCalledWith(TARGET);
    unsubscribe();

    settleComposerEnterRequest(TARGET.uid);
    expect(wasComposerEnterRequestDocked(TARGET.uid)).toBe(false);
  });

  it('leaves the layout alone for a request that does not float it', () => {
    requestComposerEnter(TARGET);
    expect(sidebarPresentation()).toBe('docked');
    settleComposerEnterRequest(TARGET.uid);
    clearPendingComposerEnterRequest();
    expect(sidebarPresentation()).toBe('docked');
  });
});
