import { generatedAPI as preferencesAPI } from '@grafana/api-clients/rtkq/preferences/v1alpha1';
import { config } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
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

  describe('when the newPreferencesPage flag is off', () => {
    it('persists via the legacy preferences API', async () => {
      await changeTheme('light', false);
      expect(backendSrv.patch).toHaveBeenCalledWith('/api/user/preferences', { theme: 'light' });
      expect(preferencesAPI.endpoints.updatePreferences.initiate).not.toHaveBeenCalled();
    });
  });

  describe('when the newPreferencesPage flag is on', () => {
    beforeEach(() => {
      setTestFlags({ [FlagKeys.GrafanaNewPreferencesPage]: true });
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
  });
});
