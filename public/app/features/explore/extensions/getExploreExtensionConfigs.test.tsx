import { PluginExtensionPoints } from '@grafana/data';
import { getFeatureFlagClient } from '@grafana/runtime/internal';
import { contextSrv } from 'app/core/services/context_srv';

import { getExploreExtensionConfigs } from './getExploreExtensionConfigs';

jest.mock('app/core/services/context_srv');

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  getFeatureFlagClient: jest.fn(),
}));

const contextSrvMock = jest.mocked(contextSrv);

describe('getExploreExtensionConfigs', () => {
  describe('configured items returned', () => {
    it('should return array with core extensions added in explore', () => {
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
          title: 'Add correlation',
          description: 'Create a correlation from this query',
          targets: [PluginExtensionPoints.ExploreToolbarAction],
          icon: 'link',
          configure: expect.any(Function),
          onClick: expect.any(Function),
        },
        {
          title: 'Add to notebook',
          description: 'Add the query and panel from explore to a notebook',
          targets: [PluginExtensionPoints.ExploreToolbarAction],
          icon: 'search',
          configure: expect.any(Function),
          onClick: expect.any(Function),
          category: 'Dashboards',
        },
      ]);
    });
  });

  // Explore's toolbar renders the bare "Add to dashboard" button only while one link is configured
  // and an "Add" dropdown past that, so a notebook link that survived configure() with the feature
  // off would change the toolbar for everyone.
  describe('configure function for "add to notebook" extension', () => {
    afterEach(() => {
      contextSrvMock.hasPermission.mockRestore();
      jest.mocked(getFeatureFlagClient).mockReset();
    });

    function notebookExtension() {
      return getExploreExtensionConfigs().find((extension) => extension.title === 'Add to notebook');
    }

    function setNotebooksEnabled(enabled: boolean) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only getBooleanValue is read
      jest
        .mocked(getFeatureFlagClient)
        .mockReturnValue({ getBooleanValue: () => enabled } as unknown as ReturnType<typeof getFeatureFlagClient>);
    }

    it('is hidden when notebooks are disabled, even with permission', () => {
      contextSrvMock.hasPermission.mockReturnValue(true);
      setNotebooksEnabled(false);

      expect(notebookExtension()?.configure?.(undefined)).toBeUndefined();
    });

    it('is hidden without permission, even with notebooks enabled', () => {
      contextSrvMock.hasPermission.mockReturnValue(false);
      setNotebooksEnabled(true);

      expect(notebookExtension()?.configure?.(undefined)).toBeUndefined();
    });

    it('is shown with notebooks enabled and permission', () => {
      contextSrvMock.hasPermission.mockReturnValue(true);
      setNotebooksEnabled(true);

      expect(notebookExtension()?.configure?.(undefined)).toEqual({});
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
});
