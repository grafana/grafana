import { act } from '@testing-library/react';
import { render, screen, userEvent } from 'test/test-utils';

import { CoreApp, getDefaultTimeRange, type PanelProps } from '@grafana/data/types';
import { config, locationService } from '@grafana/runtime';
import { sceneGraph, VizPanel } from '@grafana/scenes';
import { useElementSelection, usePanelContext } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';
import { AccessControlAction } from 'app/types/accessControl';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { applyQueryToPanel, getVizSuggestionForQuery } from '../utils/getVizSuggestionForQuery';
import { DashboardInteractions } from '../utils/interactions';
import { TRANSITION_MS } from '../utils/unconfiguredPanelUtils';

import { UnconfiguredPanelComp } from './UnconfiguredPanel';

// ─── module mocks ─────────────────────────────────────────────────────────────

jest.mock('react-use/lib/useMeasure', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    partial: jest.fn(),
    getLocation: jest.fn().mockReturnValue({ pathname: '/d/test', search: '' }),
    getHistory: jest.fn().mockReturnValue({ listen: jest.fn() }),
  },
}));

// Mock sceneGraph.getTimeRange and sceneUtils.registerRuntimePanelPlugin at module
// level so any invocation — including the module-load call to registerRuntimePanelPlugin
// and the in-handler call to getTimeRange — gets the mock.
jest.mock('@grafana/scenes', () => {
  const actual = jest.requireActual('@grafana/scenes');
  return {
    ...actual,
    sceneGraph: {
      ...actual.sceneGraph,
      getTimeRange: jest.fn(),
    },
    sceneUtils: {
      ...actual.sceneUtils,
      registerRuntimePanelPlugin: jest.fn(),
    },
  };
});

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  useElementSelection: jest.fn(),
  usePanelContext: jest.fn(),
}));

jest.mock('app/features/explore/QueryLibrary/QueryLibraryContext', () => ({
  useQueryLibraryContext: jest.fn(),
}));

jest.mock('../utils/getVizSuggestionForQuery', () => ({
  getVizSuggestionForQuery: jest.fn(),
  applyQueryToPanel: jest.fn(),
}));

jest.mock('../utils/interactions', () => ({
  DashboardInteractions: { panelActionClicked: jest.fn() },
}));

// Only mock the two functions this component imports from utils — avoid spreading
// jest.requireActual which can pull in complex scene dependencies.
jest.mock('../utils/utils', () => ({
  getVizPanelKeyForPanelId: (id: number) => `panel-${id}`,
  findVizPanelByKey: jest.fn(),
}));

// ─── typed mock references ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockUseMeasure = require('react-use/lib/useMeasure').default as jest.Mock;
const mockUseElementSelection = useElementSelection as jest.Mock;
const mockUsePanelContext = usePanelContext as jest.Mock;
const mockUseQueryLibraryContext = useQueryLibraryContext as jest.Mock;
const mockGetVizSuggestionForQuery = getVizSuggestionForQuery as jest.Mock;
const mockApplyQueryToPanel = applyQueryToPanel as jest.Mock;
const mockLocationServicePartial = locationService.partial as jest.Mock;
const mockSceneGraphGetTimeRange = sceneGraph.getTimeRange as jest.Mock;
// findVizPanelByKey is imported inside tests to keep the reference in sync with the mock
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockFindVizPanelByKey: jest.Mock = require('../utils/utils').findVizPanelByKey;

// ─── helpers ─────────────────────────────────────────────────────────────────

const defaultProps = { id: 1 } as PanelProps;
let deactivateScene: undefined | (() => void);

/** Creates and activates a DashboardScene for tests. */
function buildDashboard({ isEditing = false } = {}) {
  const dashboard = new DashboardScene({
    title: 'Test dashboard',
    uid: 'test-uid',
    body: DefaultGridLayoutManager.createEmpty(),
    isEditing,
  });
  deactivateScene?.();
  deactivateScene = dashboard.activate();
  return dashboard;
}

function renderPanel(props?: Partial<PanelProps>) {
  const result = render(<UnconfiguredPanelComp {...defaultProps} {...props} />);
  return { ...result, root: result.container.firstChild as HTMLElement };
}

// ─── setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  mockUseMeasure.mockReturnValue([jest.fn(), { width: 300, height: 200 }]);
  mockUseElementSelection.mockReturnValue({ isSelected: false });
  mockUsePanelContext.mockReturnValue({ app: CoreApp.Dashboard });
  mockUseQueryLibraryContext.mockReturnValue({ openDrawer: jest.fn(), queryLibraryEnabled: false });
  mockGetVizSuggestionForQuery.mockResolvedValue(undefined);
  mockApplyQueryToPanel.mockResolvedValue(undefined);
  mockFindVizPanelByKey.mockReturnValue(new VizPanel({ key: 'panel-1', pluginId: '__unconfigured-panel' }));
  mockSceneGraphGetTimeRange.mockReturnValue({
    state: { value: getDefaultTimeRange(), weekStart: undefined },
    subscribeToState: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
  });

  config.featureToggles.newVizSuggestions = false;
  config.featureToggles.newUnconfiguredPanel = true;
  contextSrv.isSignedIn = true;
});

afterEach(() => {
  deactivateScene?.();
  deactivateScene = undefined;
  config.featureToggles.newVizSuggestions = false;
  config.featureToggles.newUnconfiguredPanel = false;
  contextSrv.isSignedIn = false;
});

// ─── tests ────────────────────────────────────────────────────────────────────

describe('UnconfiguredPanelComp', () => {
  describe('empty state path (newVizSuggestions + PanelEditor)', () => {
    it('renders the query-prompt message when the feature toggle is on and app is PanelEditor', () => {
      config.featureToggles.newVizSuggestions = true;
      mockUsePanelContext.mockReturnValue({ app: CoreApp.PanelEditor });

      renderPanel();

      expect(screen.getByText(/run a query to visualize it here/i)).toBeInTheDocument();
    });

    it('does not show the empty state message when the feature toggle is off', () => {
      config.featureToggles.newVizSuggestions = false;
      mockUsePanelContext.mockReturnValue({ app: CoreApp.PanelEditor });
      buildDashboard({ isEditing: false });

      renderPanel();

      expect(screen.queryByText(/run a query to visualize it here/i)).not.toBeInTheDocument();
    });
  });

  describe('view mode (not editing)', () => {
    it('renders the "No visualization configured" quiet state', () => {
      buildDashboard({ isEditing: false });
      renderPanel();

      expect(screen.getByText('No visualization configured')).toBeInTheDocument();
    });

    it('does not render action buttons', () => {
      buildDashboard({ isEditing: false });
      renderPanel();

      expect(screen.queryByRole('button', { name: /configure/i })).not.toBeInTheDocument();
    });
  });

  describe('edit mode', () => {
    describe('quiet initial state', () => {
      it('shows the "No visualization configured" hint', () => {
        buildDashboard({ isEditing: true });
        renderPanel();

        expect(screen.getByText('No visualization configured')).toBeInTheDocument();
      });

      it('renders the quiet-state with the correct aria-label', () => {
        buildDashboard({ isEditing: true });
        renderPanel();

        expect(screen.getByLabelText('Unconfigured panel. Tab to see configuration options.')).toBeInTheDocument();
      });

      it('hides action buttons before any interaction', () => {
        buildDashboard({ isEditing: true });
        renderPanel();

        // Buttons are in the DOM but behind aria-hidden on their container
        expect(screen.queryByRole('button', { name: /configure visualization/i })).not.toBeInTheDocument();
      });
    });

    describe('hover reveals buttons', () => {
      it('shows "Configure visualization" button after hover', async () => {
        buildDashboard({ isEditing: true });
        const { user, root } = renderPanel();

        await user.hover(root);

        expect(screen.getByRole('button', { name: /configure visualization/i })).toBeInTheDocument();
      });

      it('shows "Use library panel" button after hover', async () => {
        buildDashboard({ isEditing: true });
        const { user, root } = renderPanel();

        await user.hover(root);

        expect(screen.getByRole('button', { name: /use library panel/i })).toBeInTheDocument();
      });

      it('hides buttons again after mouse leave and timer settles', async () => {
        jest.useFakeTimers();

        buildDashboard({ isEditing: true });
        const { root } = renderPanel();
        // Create a separate userEvent instance wired to the fake timers
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

        await user.hover(root);
        expect(screen.getByRole('button', { name: /configure visualization/i })).toBeInTheDocument();

        await user.unhover(root);
        // Buttons are still visible during the transition-to-quiet phase
        expect(screen.getByRole('button', { name: /configure visualization/i })).toBeInTheDocument();

        // Advance past the settle timer so the phase moves to Quiet
        await act(async () => {
          await jest.advanceTimersByTimeAsync(TRANSITION_MS);
        });
        expect(screen.queryByRole('button', { name: /configure visualization/i })).not.toBeInTheDocument();

        jest.useRealTimers();
      });
    });

    describe('selection as activation trigger', () => {
      it('reveals buttons when the panel is selected (without hover)', () => {
        mockUseElementSelection.mockReturnValue({ isSelected: true });
        buildDashboard({ isEditing: true });

        renderPanel();

        expect(screen.getByRole('button', { name: /configure visualization/i })).toBeInTheDocument();
      });
    });

    describe('Configure button', () => {
      it('calls locationService.partial with editPanel id', async () => {
        buildDashboard({ isEditing: true });
        const { user, root } = renderPanel();

        await user.hover(root);
        await user.click(screen.getByRole('button', { name: /configure visualization/i }));

        expect(mockLocationServicePartial).toHaveBeenCalledWith({ editPanel: 1 });
      });

      it('tracks the configure interaction', async () => {
        buildDashboard({ isEditing: true });
        const { user, root } = renderPanel();

        await user.hover(root);
        await user.click(screen.getByRole('button', { name: /configure visualization/i }));

        expect(DashboardInteractions.panelActionClicked).toHaveBeenCalledWith('configure', 1, 'panel');
      });
    });

    describe('Use library panel button', () => {
      it('calls onShowAddLibraryPanelDrawer on the dashboard', async () => {
        const dashboard = buildDashboard({ isEditing: true });
        jest.spyOn(dashboard, 'onShowAddLibraryPanelDrawer').mockImplementation(() => {});
        const { user, root } = renderPanel();

        await user.hover(root);
        await user.click(screen.getByRole('button', { name: /use library panel/i }));

        expect(dashboard.onShowAddLibraryPanelDrawer).toHaveBeenCalled();
      });
    });

    describe('queryLibraryEnabled = false', () => {
      it('does not render the "Use saved query" button', async () => {
        mockUseQueryLibraryContext.mockReturnValue({ openDrawer: jest.fn(), queryLibraryEnabled: false });
        buildDashboard({ isEditing: true });
        const { user, root } = renderPanel();

        await user.hover(root);

        expect(screen.queryByRole('button', { name: /use saved query/i })).not.toBeInTheDocument();
      });
    });

    describe('queryLibraryEnabled = true', () => {
      beforeEach(() => {
        config.featureToggles.newVizSuggestions = true;
        mockUseQueryLibraryContext.mockReturnValue({ openDrawer: jest.fn(), queryLibraryEnabled: true });
      });

      it('does not render the "Use saved query" button when newVizSuggestions is off', async () => {
        config.featureToggles.newVizSuggestions = false;
        buildDashboard({ isEditing: true });
        const { user, root } = renderPanel();

        await user.hover(root);

        expect(screen.queryByRole('button', { name: /use saved query/i })).not.toBeInTheDocument();
      });

      it('renders the "Use saved query" button', async () => {
        buildDashboard({ isEditing: true });
        const { user, root } = renderPanel();

        await user.hover(root);

        expect(screen.getByRole('button', { name: /use saved query/i })).toBeInTheDocument();
      });

      it('opens the query library drawer with unconfigured-panel context on click', async () => {
        const mockOpenDrawer = jest.fn();
        mockUseQueryLibraryContext.mockReturnValue({ openDrawer: mockOpenDrawer, queryLibraryEnabled: true });
        buildDashboard({ isEditing: true });

        const { user, root } = renderPanel();

        await user.hover(root);
        await user.click(screen.getByRole('button', { name: /use saved query/i }));

        expect(mockOpenDrawer).toHaveBeenCalledWith(
          expect.objectContaining({ options: { context: 'unconfigured-panel' } })
        );
      });

      describe('onSelectQuery callback', () => {
        const mockQuery = { refId: 'A', datasource: { uid: 'test-ds' } };
        const mockSuggestion = {
          pluginId: 'timeseries',
          name: 'timeseries',
          description: '',
          options: {},
          fieldConfig: { defaults: {}, overrides: [] },
          hash: '0',
          score: 100,
        };

        /**
         * Renders the component, hovers to reveal buttons, clicks "Use saved query",
         * and returns the onSelectQuery callback that was passed to openDrawer.
         */
        async function getOnSelectQuery() {
          const mockOpenDrawer = jest.fn();
          mockUseQueryLibraryContext.mockReturnValue({ openDrawer: mockOpenDrawer, queryLibraryEnabled: true });
          buildDashboard({ isEditing: true });

          const { user, root } = renderPanel();

          await user.hover(root);
          await user.click(screen.getByRole('button', { name: /use saved query/i }));

          expect(mockOpenDrawer).toHaveBeenCalled();
          return mockOpenDrawer.mock.calls[0][0].onSelectQuery as (
            query: typeof mockQuery,
            title?: string
          ) => Promise<void>;
        }

        it('calls applyQueryToPanel when a suggestion is found', async () => {
          const mockPanel = new VizPanel({ key: 'panel-1', pluginId: '__unconfigured-panel' });
          mockFindVizPanelByKey.mockReturnValue(mockPanel);
          mockGetVizSuggestionForQuery.mockResolvedValue(mockSuggestion);

          const onSelectQuery = await getOnSelectQuery();
          await act(async () => {
            await onSelectQuery(mockQuery, 'My Query Title');
          });

          expect(mockApplyQueryToPanel).toHaveBeenCalledWith(
            mockPanel,
            expect.any(DashboardScene),
            mockQuery,
            mockSuggestion,
            'My Query Title'
          );
        });

        it('does not call applyQueryToPanel when no suggestion is returned', async () => {
          mockGetVizSuggestionForQuery.mockResolvedValue(undefined);

          const onSelectQuery = await getOnSelectQuery();
          await act(async () => {
            await onSelectQuery(mockQuery);
          });

          expect(mockApplyQueryToPanel).not.toHaveBeenCalled();
        });

        it('does not call applyQueryToPanel and swallows the error when getVizSuggestionForQuery throws', async () => {
          mockGetVizSuggestionForQuery.mockRejectedValue(new Error('datasource timeout'));

          const onSelectQuery = await getOnSelectQuery();
          await act(async () => {
            await expect(onSelectQuery(mockQuery)).resolves.toBeUndefined();
          });

          expect(mockApplyQueryToPanel).not.toHaveBeenCalled();
        });

        it('swallows the error when applyQueryToPanel throws', async () => {
          mockGetVizSuggestionForQuery.mockResolvedValue(mockSuggestion);
          mockApplyQueryToPanel.mockRejectedValue(new Error('apply failed'));

          const onSelectQuery = await getOnSelectQuery();
          await act(async () => {
            await expect(onSelectQuery(mockQuery)).resolves.toBeUndefined();
          });
        });

        it('returns early when the panel is not found in the scene', async () => {
          mockFindVizPanelByKey.mockReturnValue(null);

          const onSelectQuery = await getOnSelectQuery();
          await act(async () => {
            await onSelectQuery(mockQuery);
          });

          expect(mockGetVizSuggestionForQuery).not.toHaveBeenCalled();
        });
      });
    });

    describe('savedQueriesRBAC = true', () => {
      beforeEach(() => {
        mockUseQueryLibraryContext.mockReturnValue({ openDrawer: jest.fn(), queryLibraryEnabled: true });
        config.featureToggles.newVizSuggestions = true;
        config.featureToggles.savedQueriesRBAC = true;
        buildDashboard({ isEditing: true });
      });

      afterEach(() => {
        config.featureToggles.savedQueriesRBAC = false;
      });

      it('renders the "Use saved query" button when the user has QueriesRead permission', async () => {
        jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
        const { user, root } = renderPanel();

        await user.hover(root);

        expect(screen.getByRole('button', { name: /use saved query/i })).toBeInTheDocument();
        expect(contextSrv.hasPermission).toHaveBeenCalledWith(AccessControlAction.QueriesRead);
      });

      it('does not render the "Use saved query" button when the user lacks QueriesRead permission', async () => {
        jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
        const { user, root } = renderPanel();

        await user.hover(root);

        expect(screen.queryByRole('button', { name: /use saved query/i })).not.toBeInTheDocument();
        expect(contextSrv.hasPermission).toHaveBeenCalledWith(AccessControlAction.QueriesRead);
      });
    });

    describe('compact mode (width < 175 and height < 150)', () => {
      beforeEach(() => {
        mockUseMeasure.mockReturnValue([jest.fn(), { width: 100, height: 100 }]);
      });

      it('shows all buttons as icon-only with tooltips', async () => {
        mockUseQueryLibraryContext.mockReturnValue({ openDrawer: jest.fn(), queryLibraryEnabled: true });
        config.featureToggles.newVizSuggestions = true;
        buildDashboard({ isEditing: true });
        const { user, root } = renderPanel();

        await user.hover(root);

        expect(screen.getByRole('button', { name: /configure visualization/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /use saved query/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /use library panel/i })).toBeInTheDocument();
      });
    });
  });
});
