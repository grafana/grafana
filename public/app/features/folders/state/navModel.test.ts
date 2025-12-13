import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { ManagerKind } from 'app/features/apiserver/types';
import { AccessControlAction } from 'app/types/accessControl';
import { FolderDTO } from 'app/types/folders';

import { buildNavModel, getAlertingTabID } from './navModel';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    unifiedAlertingEnabled: true,
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
});
