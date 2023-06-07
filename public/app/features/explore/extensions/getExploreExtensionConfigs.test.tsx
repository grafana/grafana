import { PluginExtensionPoints } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';

import { getExploreExtensionConfigs } from './getExploreExtensionConfigs';

jest.mock('app/core/services/context_srv');

const contextSrvMock = jest.mocked(contextSrv);

describe('getExploreExtensionConfigs', () => {
  describe('configured items returned', () => {
    it('should return array with core extensions added in explore', () => {
      const extensions = getExploreExtensionConfigs();

      expect(extensions).toEqual([
        {
          type: 'link',
          title: 'Dashboard',
          description: 'Use the query and panel from explore and create/add it to a dashboard',
          extensionPointId: PluginExtensionPoints.ExploreToolbarAction,
          icon: 'apps',
          configure: expect.any(Function),
          onClick: expect.any(Function),
        },
      ]);
    });
  });

  describe('configure function for "add to dashboard" extension', () => {
    afterEach(() => contextSrvMock.hasAccess.mockRestore());

    it('should return undefined if insufficient permissions', () => {
      contextSrvMock.hasAccess.mockReturnValue(false);

      const extensions = getExploreExtensionConfigs();
      const [extension] = extensions;

      expect(extension?.configure?.()).toBeUndefined();
    });

    it('should return empty object if sufficient permissions', () => {
      contextSrvMock.hasAccess.mockReturnValue(true);

      const extensions = getExploreExtensionConfigs();
      const [extension] = extensions;

      expect(extension?.configure?.()).toEqual({});
    });
  });
});
