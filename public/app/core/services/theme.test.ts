/**
 * @jest-environment-options {"resources":"usable","settings":{"enableCSSFileLoading":true}}
 */

import { waitFor } from '@testing-library/dom';

import { generatedAPI as preferencesAPI } from '@grafana/api-clients/rtkq/preferences/v1';
import { getThemeById } from '@grafana/data/internal';
import { config } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { backendSrv } from './backend_srv';
import { contextSrv } from './context_srv';
import { changeTheme } from './theme';

jest.mock('app/store/store', () => ({
  dispatch: jest.fn(() => ({ unwrap: () => Promise.resolve({}) })),
}));

describe('changeTheme', () => {
  const originalSignedIn = contextSrv.isSignedIn;
  const originalUid = contextSrv.user.uid;
  const originalTheme = config.theme2;
  const originalAssets = config.bootData.assets;

  beforeEach(() => {
    contextSrv.isSignedIn = true;
    contextSrv.user.uid = 'abc123';
    // Persistence tests do not need a colour-mode change or a stylesheet request.
    config.theme2 = getThemeById('light');
    jest.spyOn(backendSrv, 'patch').mockResolvedValue({});
    jest.spyOn(preferencesAPI.endpoints.updatePreferences, 'initiate');
  });

  afterEach(() => {
    contextSrv.isSignedIn = originalSignedIn;
    contextSrv.user.uid = originalUid;
    config.theme2 = originalTheme;
    config.bootData.assets = originalAssets;
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

  it('removes the previous theme stylesheet', async () => {
    // Self-contained assets exercise boot-data URL matching without an HTTP resource loader.
    const darkHref = 'data:text/css,body%7Bcolor%3Ablack%7D';
    const lightHref = 'data:text/css,body%7Bcolor%3Awhite%7D';
    config.theme2 = getThemeById('dark');
    config.bootData.assets = { ...config.bootData.assets, dark: darkHref, light: lightHref };

    const oldLink = document.createElement('link');
    oldLink.rel = 'stylesheet';
    oldLink.href = darkHref;
    document.head.appendChild(oldLink);
    await waitFor(() => expect(oldLink.sheet).not.toBeNull());

    const changingTheme = changeTheme('light', true);

    const newLink = document.head.querySelector<HTMLLinkElement>(`link[href="${lightHref}"]`);
    expect(newLink).not.toBeNull();
    expect(document.head.querySelector(`link[href="${darkHref}"]`)).toBe(oldLink);

    await changingTheme;
    await waitFor(() => expect(newLink!.sheet).not.toBeNull());
    expect(document.head.querySelector(`link[href="${darkHref}"]`)).toBeNull();
    expect(document.head.querySelector(`link[href="${lightHref}"]`)).not.toBeNull();
  });
});
