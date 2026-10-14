import { appEvents } from 'app/core/app_events';
import { SetExtensionSidebarPresentationEvent } from 'app/types/events';

import {
  addComposerEnterRequestListener,
  clearPendingComposerEnterRequest,
  PENDING_REQUEST_TTL_MS,
  requestComposerEnter,
  settleComposerEnterRequest,
} from './composerEntryRequests';

const TARGET = { resource: 'dashboard', uid: 'abc' } as const;

afterEach(() => {
  clearPendingComposerEnterRequest();
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

describe('a request that floated the sidebar', () => {
  const presentations: string[] = [];
  let unsubscribe = () => {};

  beforeEach(() => {
    presentations.length = 0;
    const subscription = appEvents.subscribe(SetExtensionSidebarPresentationEvent, ({ payload }) =>
      presentations.push(payload.presentation)
    );
    unsubscribe = () => subscription.unsubscribe();
  });

  afterEach(() => unsubscribe());

  it('docks the sidebar again when no session starts within 10 seconds', () => {
    jest.useFakeTimers();
    requestComposerEnter(TARGET, { floated: true });
    jest.advanceTimersByTime(PENDING_REQUEST_TTL_MS);
    expect(presentations).toEqual(['docked']);
  });

  it('docks the sidebar again when entering fails', () => {
    requestComposerEnter(TARGET, { floated: true });
    settleComposerEnterRequest(TARGET.uid, 'failed');
    expect(presentations).toEqual(['docked']);
  });

  it('docks the sidebar again when the dashboard goes away first', () => {
    requestComposerEnter(TARGET, { floated: true });
    clearPendingComposerEnterRequest();
    expect(presentations).toEqual(['docked']);
  });

  it('keeps the floating sidebar once a session starts', () => {
    jest.useFakeTimers();
    requestComposerEnter(TARGET, { floated: true });
    settleComposerEnterRequest(TARGET.uid, 'entered');
    jest.advanceTimersByTime(PENDING_REQUEST_TTL_MS);
    clearPendingComposerEnterRequest();
    expect(presentations).toEqual([]);
  });

  it('leaves the presentation alone for a request that did not float it', () => {
    requestComposerEnter(TARGET);
    settleComposerEnterRequest(TARGET.uid, 'failed');
    clearPendingComposerEnterRequest();
    expect(presentations).toEqual([]);
  });
});
