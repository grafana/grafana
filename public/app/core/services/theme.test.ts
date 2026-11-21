import { generatedAPI as preferencesAPI } from '@grafana/api-clients/rtkq/preferences/v1';
import { config, ThemeChangedEvent } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { appEvents } from '../app_events';

import { backendSrv } from './backend_srv';
import { contextSrv } from './context_srv';
import { changeTheme, connectThemeChannel } from './theme';

jest.mock('app/store/store', () => ({
  dispatch: jest.fn(() => ({ unwrap: () => Promise.resolve({}) })),
}));

describe('changeTheme', () => {
  const originalSignedIn = contextSrv.isSignedIn;
  const originalUid = contextSrv.user.uid;

  beforeEach(() => {
    contextSrv.isSignedIn = true;
    contextSrv.user.uid = 'abc123';
    // changeTheme swaps the stylesheet <link> when the colour mode changes, reading these asset URLs.
    config.bootData.assets = { ...config.bootData.assets, light: 'light.css', dark: 'dark.css' };
    jest.spyOn(backendSrv, 'patch').mockResolvedValue({});
    jest.spyOn(preferencesAPI.endpoints.updatePreferences, 'initiate');
  });

  afterEach(() => {
    contextSrv.isSignedIn = originalSignedIn;
    contextSrv.user.uid = originalUid;
    document.head.querySelectorAll('link[rel="stylesheet"]').forEach((link) => link.remove());
    setTestFlags({});
    jest.restoreAllMocks();
  });

  it('does not persist when runtimeOnly is set', async () => {
    await changeTheme('light', true);
    expect(backendSrv.patch).not.toHaveBeenCalled();
    expect(preferencesAPI.endpoints.updatePreferences.initiate).not.toHaveBeenCalled();
  });

  it('does not persist when the user is not signed in', async () => {
    contextSrv.isSignedIn = false;
    await changeTheme('light', false);
    expect(backendSrv.patch).not.toHaveBeenCalled();
    expect(preferencesAPI.endpoints.updatePreferences.initiate).not.toHaveBeenCalled();
  });

  it('persists to the user resource via the k8s preferences API', async () => {
    await changeTheme('light', false);
    expect(preferencesAPI.endpoints.updatePreferences.initiate).toHaveBeenCalledWith({
      name: 'user-abc123',
      patch: { spec: { theme: 'light' } },
    });
    expect(backendSrv.patch).not.toHaveBeenCalled();
  });

  it('falls back to the "user" resource name when the user has no uid', async () => {
    contextSrv.user.uid = '';
    await changeTheme('light', false);
    expect(preferencesAPI.endpoints.updatePreferences.initiate).toHaveBeenCalledWith({
      name: 'user',
      patch: { spec: { theme: 'light' } },
    });
  });

  it('broadcasts a preview immediately and applies previews from peers without persisting or rebroadcasting', async () => {
    const originalBroadcastChannel = Object.getOwnPropertyDescriptor(globalThis, 'BroadcastChannel');
    const channel = { postMessage: jest.fn(), close: jest.fn(), onmessage: (event: MessageEvent) => {} };
    Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: jest.fn(() => channel) });
    const disconnect = connectThemeChannel();
    const onThemeChange = jest.fn();
    const subscription = appEvents.subscribe(ThemeChangedEvent, ({ payload }) => onThemeChange(payload.colors.mode));

    try {
      const change = changeTheme('light', true);
      expect(channel.postMessage).toHaveBeenCalledWith('light');
      await change;

      channel.onmessage(new MessageEvent('message', { data: 'dark' }));
      channel.onmessage(new MessageEvent('message', { data: 'unknown-theme' }));
      expect(onThemeChange.mock.calls).toEqual([['light'], ['dark']]);
      expect(channel.postMessage).toHaveBeenCalledTimes(1);
      expect(preferencesAPI.endpoints.updatePreferences.initiate).not.toHaveBeenCalled();
    } finally {
      subscription.unsubscribe();
      disconnect?.();
      if (originalBroadcastChannel) {
        Object.defineProperty(globalThis, 'BroadcastChannel', originalBroadcastChannel);
      } else {
        Reflect.deleteProperty(globalThis, 'BroadcastChannel');
      }
    }
    expect(channel.close).toHaveBeenCalledTimes(1);
  });

  it('keeps the active stylesheet when a preview is reversed before loading finishes', async () => {
    const originalLink = document.createElement('link');
    originalLink.rel = 'stylesheet';
    originalLink.href = 'dark.css';
    document.head.appendChild(originalLink);

    await changeTheme('light', true);
    const pendingLink = document.head.querySelector<HTMLLinkElement>('link[href="light.css"]');
    await changeTheme('dark', true);
    pendingLink?.dispatchEvent(new Event('load'));

    expect(document.head.querySelector('link[href="dark.css"]')).toBe(originalLink);
    expect(document.head.querySelector('link[href="light.css"]')).toBeNull();
  });

  it('removes the previous theme stylesheet', async () => {
    const darkHref = 'public/build/grafana.dark.abc123.css';
    const lightHref = 'public/build/grafana.light.def456.css';
    config.bootData.assets = { ...config.bootData.assets, dark: darkHref, light: lightHref };
    const oldLink = document.createElement('link');
    oldLink.rel = 'stylesheet';
    oldLink.href = darkHref;
    document.head.appendChild(oldLink);

    await changeTheme('light', true);

    const newLink = document.head.querySelector<HTMLLinkElement>(`link[href="${lightHref}"]`);
    expect(newLink).not.toBeNull();
    newLink!.onload!(new Event('load'));

    expect(document.head.querySelector(`link[href="${darkHref}"]`)).toBeNull();
    expect(document.head.querySelector(`link[href="${lightHref}"]`)).not.toBeNull();
  });
});
