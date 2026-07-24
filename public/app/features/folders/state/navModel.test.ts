import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { ManagerKind } from 'app/features/apiserver/types';
import { AccessControlAction } from 'app/types/accessControl';
import { type FolderDTO } from 'app/types/folders';

import { buildNavModel, getAlertingTabID, getVariablesTabID } from './navModel';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    unifiedAlertingEnabled: true,
    featureToggles: {
      globalDashboardVariables: false,
    },
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
    config.featureToggles.globalDashboardVariables = false;
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

  describe('Variables tab visibility', () => {
    it('should hide Variables tab when globalDashboardVariables is off', () => {
      const navModel = buildNavModel(mockFolder);
      const variablesTab = navModel.children?.find((child) => child.id === getVariablesTabID(mockFolder.uid));

      expect(variablesTab).toBeUndefined();
    });

    it('should show Variables tab when globalDashboardVariables is on', () => {
      config.featureToggles.globalDashboardVariables = true;

      const navModel = buildNavModel(mockFolder);
      const variablesTab = navModel.children?.find((child) => child.id === getVariablesTabID(mockFolder.uid));

      expect(variablesTab).toBeDefined();
      expect(variablesTab?.icon).toBe('brackets-curly');
      expect(variablesTab?.url).toBe(`${mockFolder.url}/variables`);
    });

    it('should hide Variables tab for Git-synced folders even when the toggle is on', () => {
      config.featureToggles.globalDashboardVariables = true;
      const gitSyncedFolder: FolderDTO = {
        ...mockFolder,
        managedBy: ManagerKind.Repo,
      };

      const navModel = buildNavModel(gitSyncedFolder);
      const variablesTab = navModel.children?.find((child) => child.id === getVariablesTabID(mockFolder.uid));

      expect(variablesTab).toBeUndefined();
    });
  });
});
