import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { ManagerKind } from 'app/features/apiserver/types';
import { AccessControlAction } from 'app/types/accessControl';
import { type FolderDTO } from 'app/types/folders';

import { buildNavModel, getAlertingTabID, getReadmeTabID } from './navModel';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    unifiedAlertingEnabled: true,
    featureToggles: {},
  },
}));

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    hasPermission: jest.fn(),
  },
}));

describe('buildNavModel', () => {
  const mockFolder: FolderDTO = {
    uid: 'test-folder-uid',
    title: 'Test Folder',
    url: '/dashboards/f/test-folder-uid',
    id: 1,
    created: '',
    createdBy: '',
    hasAcl: false,
    updated: '',
    updatedBy: '',
    canSave: true,
    canEdit: true,
    canAdmin: true,
    canDelete: true,
    version: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (contextSrv.hasPermission as jest.Mock).mockReturnValue(true);
    config.unifiedAlertingEnabled = true;
  });

  describe('Alerts tab visibility', () => {
    it('should show Alerts tab for regular (non-managed) folders when user has permissions', () => {
      const navModel = buildNavModel(mockFolder);
      const alertingTab = navModel.children?.find((child) => child.id === getAlertingTabID(mockFolder.uid));

      expect(alertingTab).toBeDefined();
      expect(alertingTab?.text).toContain('Alert rules');
    });

    it('should hide Alerts tab for Git-synced folders', () => {
      const gitSyncedFolder: FolderDTO = {
        ...mockFolder,
        managedBy: ManagerKind.Repo,
      };

      const navModel = buildNavModel(gitSyncedFolder);
      const alertingTab = navModel.children?.find((child) => child.id === getAlertingTabID(mockFolder.uid));

      expect(alertingTab).toBeUndefined();
    });

    it('should hide Alerts tab when user lacks AlertingRuleRead permission', () => {
      (contextSrv.hasPermission as jest.Mock).mockReturnValue(false);

      const navModel = buildNavModel(mockFolder);
      const alertingTab = navModel.children?.find((child) => child.id === getAlertingTabID(mockFolder.uid));

      expect(alertingTab).toBeUndefined();
      expect(contextSrv.hasPermission).toHaveBeenCalledWith(AccessControlAction.AlertingRuleRead);
    });

    it('should hide Alerts tab when unified alerting is disabled', () => {
      config.unifiedAlertingEnabled = false;

      const navModel = buildNavModel(mockFolder);
      const alertingTab = navModel.children?.find((child) => child.id === getAlertingTabID(mockFolder.uid));

      expect(alertingTab).toBeUndefined();
    });

    it('should show Alerts tab for regular folders with all conditions met', () => {
      const navModel = buildNavModel(mockFolder);
      const alertingTab = navModel.children?.find((child) => child.id === getAlertingTabID(mockFolder.uid));

      expect(alertingTab).toBeDefined();
      expect(alertingTab?.icon).toBe('bell');
      expect(alertingTab?.url).toBe(`${mockFolder.url}/alerting`);
    });
  });

  describe('README tab visibility', () => {
    afterEach(() => {
      // Reset between tests so toggles don't leak.
      config.featureToggles = {};
    });

    it('shows the README tab first when a folder is provisioned and the toggle is enabled', () => {
      config.featureToggles = { provisioningReadmes: true };

      const provisionedFolder: FolderDTO = { ...mockFolder, managedBy: ManagerKind.Repo };

      const navModel = buildNavModel(provisionedFolder);
      const readmeTab = navModel.children?.find((child) => child.id === getReadmeTabID(provisionedFolder.uid));

      expect(readmeTab).toBeDefined();
      expect(readmeTab?.url).toBe(`${provisionedFolder.url}/readme`);
      expect(navModel.children?.[0]?.id).toBe(getReadmeTabID(provisionedFolder.uid));
    });

    it('hides the README tab when the toggle is off', () => {
      config.featureToggles = { provisioningReadmes: false };

      const provisionedFolder: FolderDTO = { ...mockFolder, managedBy: ManagerKind.Repo };

      const navModel = buildNavModel(provisionedFolder);
      const readmeTab = navModel.children?.find((child) => child.id === getReadmeTabID(provisionedFolder.uid));

      expect(readmeTab).toBeUndefined();
    });

    it('hides the README tab on non-provisioned folders even when the toggle is on', () => {
      config.featureToggles = { provisioningReadmes: true };

      const navModel = buildNavModel(mockFolder);
      const readmeTab = navModel.children?.find((child) => child.id === getReadmeTabID(mockFolder.uid));

      expect(readmeTab).toBeUndefined();
    });
  });
});
