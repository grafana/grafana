import { render, screen } from 'test/test-utils';

import { type PluginExtensionEventHelpers, PluginExtensionPoints } from '@grafana/data';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';
import { ADD_PANEL_MODAL_WIDTH, addPanelToNotebookTitle } from 'app/features/notebook/addPanel/addPanelModal';

import { getExploreExtensionConfigs } from './getExploreExtensionConfigs';

jest.mock('app/core/services/context_srv');

// Stood in for so the lazy import resolves without dragging the notebook picker and its API into
// this suite. What matters here is that the modal mounts it, pointed at the right pane.
jest.mock('./AddToNotebook/ExploreToNotebookPanel', () => ({
  ExploreToNotebookPanel: ({ exploreId }: { exploreId: string }) => <div>notebook picker for {exploreId}</div>,
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
      setTestFlags({});
    });

    function notebookExtension() {
      return getExploreExtensionConfigs().find((extension) => extension.title === 'Add to notebook');
    }

    function setNotebooksEnabled(enabled: boolean) {
      setTestFlags({ [FlagKeys.DashboardNotebooks]: enabled });
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

    // The toolbar button is Explore's only way into the picker, and the pane it was clicked from is
    // the one whose queries get captured - a split view has two.
    it('opens the picker on the pane it was clicked from, in a modal wide enough for it', async () => {
      contextSrvMock.hasPermission.mockReturnValue(true);
      setNotebooksEnabled(true);
      const openModal = jest.fn();

      notebookExtension()?.onClick?.(undefined, {
        context: { exploreId: 'left' },
        extensionPointId: PluginExtensionPoints.ExploreToolbarAction,
        openModal,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the handler reads only these three
      } as unknown as PluginExtensionEventHelpers<{ exploreId: string }>);

      expect(openModal).toHaveBeenCalledWith(
        expect.objectContaining({ title: addPanelToNotebookTitle(), width: ADD_PANEL_MODAL_WIDTH })
      );

      const ModalBody = openModal.mock.calls[0][0].body;
      render(<ModalBody onDismiss={jest.fn()} />);

      expect(await screen.findByText('notebook picker for left')).toBeInTheDocument();
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
