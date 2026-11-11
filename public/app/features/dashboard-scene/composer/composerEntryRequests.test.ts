import { config } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';
import {
  getEffectiveExtensionSidebarPresentation,
  resetExtensionSidebarPresentationForTests,
  setExtensionSidebarPresentation,
} from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarLayout';

import {
  addComposerEnterRequestListener,
  clearPendingComposerEnterRequest,
  getPendingComposerEnterTarget,
  getSupportedComposerResources,
  PENDING_REQUEST_TTL_MS,
  requestComposerEnter,
  resetComposerEnterRequestsForTests,
  settleComposerEnterRequest,
  subscribeToComposerEnterRequests,
} from './composerEntryRequests';
import { type ComposerEnterRequestOptions } from './types';

// The Assistant's sidebar: the plugin that may float.
const sidebarPresentation = () => getEffectiveExtensionSidebarPresentation('grafana-assistant-app');

const TARGET = { resource: 'dashboard', uid: 'abc' } as const;
const NOTEBOOK = { resource: 'notebook', uid: 'nb' } as const;
const cleanups: Array<() => void> = [];

/** Registers a listener for the rest of the test. */
function listen(options?: ComposerEnterRequestOptions, listener: jest.Mock = jest.fn()) {
  const unsubscribe = addComposerEnterRequestListener(listener, options);
  cleanups.push(unsubscribe);
  return { listener, unsubscribe };
}

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  resetComposerEnterRequestsForTests();
  resetExtensionSidebarPresentationForTests();
  jest.useRealTimers();
});

describe('supported document types', () => {
  it('are dashboards only for a listener registered without options', () => {
    listen();
    expect(getSupportedComposerResources()).toEqual(['dashboard']);
  });

  it('are the union across live listeners', () => {
    listen();
    listen({ resources: ['notebook'] });
    expect(getSupportedComposerResources()).toEqual(['dashboard', 'notebook']);
  });

  it('narrow when a listener registers again with fewer, and empty once all unsubscribe', () => {
    const changed = jest.fn();
    cleanups.push(subscribeToComposerEnterRequests(changed));
    const first = listen({ resources: ['dashboard', 'notebook'] });
    expect(getSupportedComposerResources()).toEqual(['dashboard', 'notebook']);
    first.unsubscribe();
    const second = listen({ resources: ['dashboard'] });
    expect(getSupportedComposerResources()).toEqual(['dashboard']);

    second.unsubscribe();

    expect(getSupportedComposerResources()).toEqual([]);
    // dashboard+notebook, nothing, dashboard, nothing.
    expect(changed).toHaveBeenCalledTimes(4);
  });

  it('ignore what is not a document type', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a plugin calling from untyped code
    listen({ resources: ['notebook', 'canvas'] as unknown as ComposerEnterRequestOptions['resources'] });
    expect(getSupportedComposerResources()).toEqual(['notebook']);
  });

  it('keep one array between changes', () => {
    listen();
    expect(getSupportedComposerResources()).toBe(getSupportedComposerResources());
  });
});

it('delivers to the first listener that supports the resource, immediately and once', () => {
  const first = listen();
  const second = listen();

  expect(requestComposerEnter(TARGET)).toBe(true);

  expect(first.listener).toHaveBeenCalledWith(TARGET);
  expect(second.listener).not.toHaveBeenCalled();
});

it('passes a notebook request over a listener that only knows dashboards', () => {
  const dashboards = listen();
  const notebooks = listen({ resources: ['dashboard', 'notebook'] });

  requestComposerEnter(NOTEBOOK);

  expect(dashboards.listener).not.toHaveBeenCalled();
  expect(notebooks.listener).toHaveBeenCalledWith(NOTEBOOK);
});

it('never makes a request no listener supports', () => {
  listen();

  expect(requestComposerEnter(NOTEBOOK, { float: true })).toBe(false);

  expect(getPendingComposerEnterTarget()).toBeUndefined();
  expect(sidebarPresentation()).toBe('docked');
});

it('makes no request while nothing listens, and none fires later', () => {
  expect(requestComposerEnter(TARGET)).toBe(false);

  const { listener } = listen();
  expect(listener).not.toHaveBeenCalled();
});

it('stops delivering to a listener once it unsubscribes', () => {
  const { listener, unsubscribe } = listen();
  unsubscribe();
  requestComposerEnter(TARGET);
  expect(listener).not.toHaveBeenCalled();
});

// grafana.extensionSidebarFloating is off here: a request floats the sidebar without it.
describe('a request that floats the sidebar', () => {
  let assistant: jest.Mock;

  beforeEach(() => {
    assistant = listen().listener;
  });

  it('floats the sidebar while it waits for the entry attempt', () => {
    requestComposerEnter(TARGET, { float: true });
    expect(assistant).toHaveBeenCalledWith(TARGET);
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

  it('ignores the settling of another dashboard', () => {
    requestComposerEnter(TARGET, { float: true });
    settleComposerEnterRequest('another-dashboard');
    expect(sidebarPresentation()).toBe('floating');
  });

  it('still goes ahead, docked, when the user docks the sidebar while it waits', () => {
    requestComposerEnter(TARGET, { float: true });
    setExtensionSidebarPresentation('docked');
    expect(sidebarPresentation()).toBe('docked');
    expect(getPendingComposerEnterTarget()).toEqual(TARGET);
  });

  it('leaves the layout alone for a request that does not float it', () => {
    requestComposerEnter(TARGET);
    expect(sidebarPresentation()).toBe('docked');
    settleComposerEnterRequest(TARGET.uid);
    clearPendingComposerEnterRequest();
    expect(sidebarPresentation()).toBe('docked');
  });
});

describe('the outstanding request', () => {
  beforeEach(() => {
    listen();
  });

  it('stays outstanding after the listener takes it, until its entry attempt settles', () => {
    const changed = jest.fn();
    cleanups.push(subscribeToComposerEnterRequests(changed));
    requestComposerEnter(TARGET);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(getPendingComposerEnterTarget()).toEqual(TARGET);

    settleComposerEnterRequest('another-dashboard');
    expect(getPendingComposerEnterTarget()).toEqual(TARGET);
    settleComposerEnterRequest(TARGET.uid);

    expect(getPendingComposerEnterTarget()).toBeUndefined();
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it('ends after 10 seconds, or when cleared', () => {
    jest.useFakeTimers();
    requestComposerEnter(TARGET);
    jest.advanceTimersByTime(PENDING_REQUEST_TTL_MS);
    expect(getPendingComposerEnterTarget()).toBeUndefined();

    requestComposerEnter(TARGET);
    clearPendingComposerEnterRequest();
    expect(getPendingComposerEnterTarget()).toBeUndefined();
  });
});

describe('a listener that declines', () => {
  it('ends the request at once and stops floating the sidebar', () => {
    const decline = listen(
      undefined,
      jest.fn(() => false)
    ).listener;

    expect(requestComposerEnter(TARGET, { float: true })).toBe(false);

    expect(decline).toHaveBeenCalledWith(TARGET);
    expect(getPendingComposerEnterTarget()).toBeUndefined();
    expect(sidebarPresentation()).toBe('docked');
  });

  it('does not pass the request on to another listener', () => {
    listen(
      undefined,
      jest.fn(() => false)
    );
    const second = listen().listener;

    requestComposerEnter(TARGET, { float: true });

    expect(second).not.toHaveBeenCalled();
  });

  it('tells subscribers the request ended', () => {
    listen(
      undefined,
      jest.fn(() => false)
    );
    const changed = jest.fn();
    cleanups.push(subscribeToComposerEnterRequests(changed));

    requestComposerEnter(TARGET);

    // Started, then ended.
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it('keeps the request outstanding when the listener returns anything but false', () => {
    listen(
      undefined,
      jest.fn(() => undefined)
    );
    expect(requestComposerEnter(TARGET, { float: true })).toBe(true);
    expect(getPendingComposerEnterTarget()).toEqual(TARGET);
    expect(sidebarPresentation()).toBe('floating');
  });
});

// A fresh load with the Assistant sidebar closed: Assistant registers only once one of its roots mounts.
describe('before Assistant first registers', () => {
  const COMPOSER_FLAGS = {
    dashboardNewLayouts: true,
    'grafana.dashboardPreviewMode': true,
    'grafana.dashboardComposer': true,
  };
  const original = {
    allow: config.bootData.settings.pluginRestrictedAPIsAllowList,
    block: config.bootData.settings.pluginRestrictedAPIsBlockList,
  };

  beforeEach(() => {
    setTestFlags(COMPOSER_FLAGS);
    config.bootData.settings.pluginRestrictedAPIsAllowList = { composer: ['grafana-assistant-app'] };
    config.bootData.settings.pluginRestrictedAPIsBlockList = undefined;
  });

  afterEach(() => {
    setTestFlags({});
    config.bootData.settings.pluginRestrictedAPIsAllowList = original.allow;
    config.bootData.settings.pluginRestrictedAPIsBlockList = original.block;
  });

  it('assumes dashboards, never notebooks', () => {
    expect(getSupportedComposerResources()).toEqual(['dashboard']);
    expect(requestComposerEnter(NOTEBOOK, { float: true })).toBe(false);
    expect(sidebarPresentation()).toBe('docked');
  });

  it.each([
    ['grafana.dashboardComposer is off', () => setTestFlags({ ...COMPOSER_FLAGS, 'grafana.dashboardComposer': false })],
    [
      'the composer API is not allowed for Assistant',
      () => (config.bootData.settings.pluginRestrictedAPIsAllowList = { composer: ['another-app'] }),
    ],
    [
      'the composer API is blocked for Assistant',
      () => {
        config.bootData.settings.pluginRestrictedAPIsAllowList = {};
        config.bootData.settings.pluginRestrictedAPIsBlockList = { composer: ['grafana-assistant-app'] };
      },
    ],
  ])('assumes nothing while %s', (_, arrange) => {
    arrange();
    expect(getSupportedComposerResources()).toEqual([]);
    expect(requestComposerEnter(TARGET, { float: true })).toBe(false);
  });

  it('holds a dashboard request, floating, and delivers it once to the first listener that registers', () => {
    expect(requestComposerEnter(TARGET, { float: true })).toBe(true);
    expect(getPendingComposerEnterTarget()).toEqual(TARGET);
    expect(sidebarPresentation()).toBe('floating');

    const first = listen();
    const second = listen();

    expect(first.listener).toHaveBeenCalledTimes(1);
    expect(first.listener).toHaveBeenCalledWith(TARGET);
    expect(second.listener).not.toHaveBeenCalled();
    // Outstanding, and floating, until the entry attempt settles.
    expect(getPendingComposerEnterTarget()).toEqual(TARGET);
    expect(sidebarPresentation()).toBe('floating');
  });

  it('releases a held request after 10 seconds, and delivers nothing later', () => {
    jest.useFakeTimers();
    requestComposerEnter(TARGET, { float: true });

    jest.advanceTimersByTime(PENDING_REQUEST_TTL_MS);

    expect(getPendingComposerEnterTarget()).toBeUndefined();
    expect(sidebarPresentation()).toBe('docked');
    const { listener } = listen();
    expect(listener).not.toHaveBeenCalled();
  });

  it('settles a held request the first listener declines as it registers', () => {
    requestComposerEnter(TARGET, { float: true });
    expect(sidebarPresentation()).toBe('floating');

    const decline = listen(
      undefined,
      jest.fn(() => false)
    ).listener;
    const second = listen().listener;

    expect(decline).toHaveBeenCalledWith(TARGET);
    expect(second).not.toHaveBeenCalled();
    expect(getPendingComposerEnterTarget()).toBeUndefined();
    expect(sidebarPresentation()).toBe('docked');
  });

  it('releases a held request the first listener does not support', () => {
    requestComposerEnter(TARGET, { float: true });

    const { listener } = listen({ resources: ['notebook'] });

    expect(listener).not.toHaveBeenCalled();
    expect(getPendingComposerEnterTarget()).toBeUndefined();
    expect(sidebarPresentation()).toBe('docked');
  });

  it('uses only the declared types once Assistant has registered, even after everything unsubscribes', () => {
    const { unsubscribe } = listen({ resources: ['dashboard', 'notebook'] });
    expect(getSupportedComposerResources()).toEqual(['dashboard', 'notebook']);

    unsubscribe();

    expect(getSupportedComposerResources()).toEqual([]);
    expect(requestComposerEnter(TARGET, { float: true })).toBe(false);
  });

  it('tells subscribers when the first registration replaces the assumption', () => {
    const changed = jest.fn();
    cleanups.push(subscribeToComposerEnterRequests(changed));
    listen({ resources: ['notebook'] });
    expect(changed).toHaveBeenCalledTimes(1);
    expect(getSupportedComposerResources()).toEqual(['notebook']);
  });
});
