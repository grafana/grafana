import { config } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';
import {
  getExtensionSidebarPresentation,
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
  wasComposerEnterRequestDocked,
} from './composerEntryRequests';
import { type ComposerEnterRequestOptions } from './types';

const TARGET = { resource: 'dashboard', uid: 'abc' } as const;
const NOTEBOOK = { resource: 'notebook', uid: 'nb' } as const;
const cleanups: Array<() => void> = [];

/** Registers a listener for the rest of the test. */
function listen(options?: ComposerEnterRequestOptions) {
  const listener = jest.fn();
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
  expect(getExtensionSidebarPresentation()).toBe('docked');
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
    expect(getExtensionSidebarPresentation()).toBe('floating');
  });

  it('docks the sidebar again when no session starts within 10 seconds', () => {
    jest.useFakeTimers();
    requestComposerEnter(TARGET, { float: true });
    jest.advanceTimersByTime(PENDING_REQUEST_TTL_MS);
    expect(getExtensionSidebarPresentation()).toBe('docked');
  });

  it('docks the sidebar again when the entry attempt settles without a session', () => {
    requestComposerEnter(TARGET, { float: true });
    settleComposerEnterRequest(TARGET.uid);
    expect(getExtensionSidebarPresentation()).toBe('docked');
  });

  it('docks the sidebar again when the dashboard goes away first', () => {
    requestComposerEnter(TARGET, { float: true });
    clearPendingComposerEnterRequest();
    expect(getExtensionSidebarPresentation()).toBe('docked');
  });

  it('ignores the settling of another dashboard', () => {
    requestComposerEnter(TARGET, { float: true });
    settleComposerEnterRequest('another-dashboard');
    expect(getExtensionSidebarPresentation()).toBe('floating');
  });

  it('still goes ahead, docked, when the user docks the sidebar while it waits', () => {
    requestComposerEnter(TARGET, { float: true });
    expect(wasComposerEnterRequestDocked(TARGET.uid)).toBe(false);
    setExtensionSidebarPresentation('docked');
    expect(getExtensionSidebarPresentation()).toBe('docked');
    expect(wasComposerEnterRequestDocked(TARGET.uid)).toBe(true);
    expect(wasComposerEnterRequestDocked('another-dashboard')).toBe(false);
    expect(getPendingComposerEnterTarget()).toEqual(TARGET);

    settleComposerEnterRequest(TARGET.uid);
    expect(wasComposerEnterRequestDocked(TARGET.uid)).toBe(false);
  });

  it('leaves the layout alone for a request that does not float it', () => {
    requestComposerEnter(TARGET);
    expect(getExtensionSidebarPresentation()).toBe('docked');
    settleComposerEnterRequest(TARGET.uid);
    clearPendingComposerEnterRequest();
    expect(getExtensionSidebarPresentation()).toBe('docked');
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

// A fresh load with the Assistant sidebar closed: Assistant registers only once one of its roots mounts.
describe('before Assistant first registers', () => {
  const COMPOSER_FLAGS = {
    dashboardNewLayouts: true,
    'grafana.dashboardPreviewMode': true,
    'grafana.dashboardComposer': true,
  };
  const original = {
    restrictedPluginApis: config.featureToggles.restrictedPluginApis,
    allow: config.bootData.settings.pluginRestrictedAPIsAllowList,
    block: config.bootData.settings.pluginRestrictedAPIsBlockList,
  };

  beforeEach(() => {
    setTestFlags(COMPOSER_FLAGS);
    config.featureToggles.restrictedPluginApis = true;
    config.bootData.settings.pluginRestrictedAPIsAllowList = { composer: ['grafana-assistant-app'] };
    config.bootData.settings.pluginRestrictedAPIsBlockList = undefined;
  });

  afterEach(() => {
    setTestFlags({});
    config.featureToggles.restrictedPluginApis = original.restrictedPluginApis;
    config.bootData.settings.pluginRestrictedAPIsAllowList = original.allow;
    config.bootData.settings.pluginRestrictedAPIsBlockList = original.block;
  });

  it('assumes dashboards, never notebooks', () => {
    expect(getSupportedComposerResources()).toEqual(['dashboard']);
    expect(requestComposerEnter(NOTEBOOK, { float: true })).toBe(false);
    expect(getExtensionSidebarPresentation()).toBe('docked');
  });

  it.each([
    ['grafana.dashboardComposer is off', () => setTestFlags({ ...COMPOSER_FLAGS, 'grafana.dashboardComposer': false })],
    ['the restricted APIs are off', () => (config.featureToggles.restrictedPluginApis = false)],
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
    expect(getExtensionSidebarPresentation()).toBe('floating');

    const first = listen();
    const second = listen();

    expect(first.listener).toHaveBeenCalledTimes(1);
    expect(first.listener).toHaveBeenCalledWith(TARGET);
    expect(second.listener).not.toHaveBeenCalled();
    // Outstanding, and floating, until the entry attempt settles.
    expect(getPendingComposerEnterTarget()).toEqual(TARGET);
    expect(getExtensionSidebarPresentation()).toBe('floating');
  });

  it('releases a held request after 10 seconds, and delivers nothing later', () => {
    jest.useFakeTimers();
    requestComposerEnter(TARGET, { float: true });

    jest.advanceTimersByTime(PENDING_REQUEST_TTL_MS);

    expect(getPendingComposerEnterTarget()).toBeUndefined();
    expect(getExtensionSidebarPresentation()).toBe('docked');
    const { listener } = listen();
    expect(listener).not.toHaveBeenCalled();
  });

  it('releases a held request the first listener does not support', () => {
    requestComposerEnter(TARGET, { float: true });

    const { listener } = listen({ resources: ['notebook'] });

    expect(listener).not.toHaveBeenCalled();
    expect(getPendingComposerEnterTarget()).toBeUndefined();
    expect(getExtensionSidebarPresentation()).toBe('docked');
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
