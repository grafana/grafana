import { generatedAPI as preferencesAPI } from '@grafana/api-clients/rtkq/preferences/v1';
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

  // The build directory name differs per bundler, so the old stylesheet has to be matched by
  // the URL the backend published rather than by a hardcoded path fragment.
  it.each([
    ['webpack', 'public/build/grafana.dark.abc123.css', 'public/build/grafana.light.def456.css'],
    ['rspack', 'public/build/rspack/grafana.dark.abc123.css', 'public/build/rspack/grafana.light.def456.css'],
  ])('removes the previous theme stylesheet under %s', async (_bundler, darkHref, lightHref) => {
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
