import { PluginExtensionPoints } from '@grafana/data';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { type PluginExtensionExploreContext } from './ToolbarExtensionPoint';
import { getExploreExtensionConfigs } from './getExploreExtensionConfigs';

jest.mock('app/core/services/context_srv');
jest.mock('./AddAlertRule/ExploreToAlertingModal', () => ({
  ExploreToAlertingModal: () => null,
}));

const contextSrvMock = jest.mocked(contextSrv);

describe('getExploreExtensionConfigs', () => {
  describe('configured items returned', () => {
    it('should return array with core extensions added in explore', () => {
      contextSrvMock.hasPermission.mockReturnValue(true);
      config.unifiedAlertingEnabled = true;

      const extensions = getExploreExtensionConfigs();

      expect(extensions).toEqual([
        {
          title: 'Add to dashboard',
          description: 'Use the query and panel from explore and create/add it to a dashboard',
          targets: [PluginExtensionPoints.ExploreToolbarAction],
          icon: 'apps',
          configure: expect.any(Function),
          onClick: expect.any(Function),
          category: 'Dashboards',
        },
        {
          title: 'Add alert rule',
          description: 'Create an alert rule from the current Explore query',
          targets: [PluginExtensionPoints.ExploreToolbarAction],
          icon: 'bell',
          category: 'Alerts',
          configure: expect.any(Function),
          onClick: expect.any(Function),
        },
        {
          title: 'Add correlation',
          description: 'Create a correlation from this query',
          targets: [PluginExtensionPoints.ExploreToolbarAction],
          icon: 'link',
          configure: expect.any(Function),
          onClick: expect.any(Function),
        },
      ]);
    });
  });

  describe('configure function for "add to dashboard" extension', () => {
    afterEach(() => contextSrvMock.hasPermission.mockRestore());

    it('should return undefined if insufficient permissions', () => {
      contextSrvMock.hasPermission.mockReturnValue(false);

      const extensions = getExploreExtensionConfigs();
      const [extension] = extensions;

      expect(extension?.configure?.(undefined)).toBeUndefined();
    });

    it('should return empty object if sufficient permissions', () => {
      contextSrvMock.hasPermission.mockReturnValue(true);

      const extensions = getExploreExtensionConfigs();
      const [extension] = extensions;

      expect(extension?.configure?.(undefined)).toEqual({});
    });
  });

  describe('configure function for "add alert rule" extension', () => {
    afterEach(() => {
      contextSrvMock.hasPermission.mockRestore();
      config.unifiedAlertingEnabled = true;
    });

    it('should return undefined if unified alerting is disabled', () => {
      contextSrvMock.hasPermission.mockReturnValue(true);
      config.unifiedAlertingEnabled = false;

      const extensions = getExploreExtensionConfigs();
      const alertRuleExtension = extensions.find((e) => e.title === 'Add alert rule');

      const context = { targets: [{ refId: 'A', datasource: { uid: 'ds1' } }] } as unknown as PluginExtensionExploreContext;
      expect(alertRuleExtension?.configure?.(context)).toBeUndefined();
    });

    it('should return undefined if user has no alerting permissions', () => {
      contextSrvMock.hasPermission.mockReturnValue(false);
      config.unifiedAlertingEnabled = true;

      const extensions = getExploreExtensionConfigs();
      const alertRuleExtension = extensions.find((e) => e.title === 'Add alert rule');

      const context = { targets: [{ refId: 'A', datasource: { uid: 'ds1' } }] } as unknown as PluginExtensionExploreContext;
      expect(alertRuleExtension?.configure?.(context)).toBeUndefined();
    });

    it('should return undefined if there are no queries', () => {
      contextSrvMock.hasPermission.mockReturnValue(true);
      config.unifiedAlertingEnabled = true;

      const extensions = getExploreExtensionConfigs();
      const alertRuleExtension = extensions.find((e) => e.title === 'Add alert rule');

      const context = { targets: [] } as unknown as PluginExtensionExploreContext;
      expect(alertRuleExtension?.configure?.(context)).toBeUndefined();
    });

    it('should return empty object if alerting is enabled, user has permissions, and there are queries', () => {
      contextSrvMock.hasPermission.mockReturnValue(true);
      config.unifiedAlertingEnabled = true;

      const extensions = getExploreExtensionConfigs();
      const alertRuleExtension = extensions.find((e) => e.title === 'Add alert rule');

      const context = { targets: [{ refId: 'A', datasource: { uid: 'ds1' } }] } as unknown as PluginExtensionExploreContext;
      expect(alertRuleExtension?.configure?.(context)).toEqual({});
    });
  });
});
