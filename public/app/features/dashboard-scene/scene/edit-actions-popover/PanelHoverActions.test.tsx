import { act, fireEvent, render, screen, userEvent } from 'test/test-utils';

import { locationService } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { VizPanel, VizPanelMenu } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { ElementSelectionContext } from '@grafana/ui';

import { DashboardInteractions } from '../../utils/interactions';
import { tryGetExploreUrlForPanel } from '../../utils/urlBuilders';
import { DashboardScene } from '../DashboardScene';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';

import { WAIT_FOR_MOUSE_REST_DURATION_MS } from './EditActionsPopover';
import { PanelEditActionsWrapper } from './PanelEditActions';
import { PanelHoverActionsWrapper } from './PanelHoverActions';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    ...jest.requireActual('@grafana/runtime').locationService,
    partial: jest.fn(),
    push: jest.fn(),
  },
}));
const mockPartial = jest.mocked(locationService.partial);
const mockPush = jest.mocked(locationService.push);

// Resolving an explore url needs a datasource
jest.mock('../../utils/urlBuilders', () => ({
  ...jest.requireActual('../../utils/urlBuilders'),
  tryGetExploreUrlForPanel: jest.fn(),
}));
const mockTryGetExploreUrl = jest.mocked(tryGetExploreUrlForPanel);

jest.mock('./EditActionsPopover', () => ({
  ...jest.requireActual('./EditActionsPopover'),
  useHoverPopoverSupported: () => true,
}));

async function hoverAndRest(element: HTMLElement) {
  jest.useFakeTimers();
  try {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.hover(element);
    act(() => {
      jest.advanceTimersByTime(WAIT_FOR_MOUSE_REST_DURATION_MS);
    });
  } finally {
    jest.useRealTimers();
  }
  // Let the explore url lookup started by the opened popover settle
  await act(() => Promise.resolve());
}

function setup({
  isEditing = false,
  viewPanel,
  canEdit = true,
  withMenu = true,
}: { isEditing?: boolean; viewPanel?: string; canEdit?: boolean; withMenu?: boolean } = {}) {
  const menu = withMenu ? new VizPanelMenu({ items: [{ text: 'Inspect' }] }) : undefined;
  const panel = new VizPanel({ title: 'Panel A', pluginId: 'timeseries', key: 'panel-1', menu });
  const dashboard = new DashboardScene({
    isEditing,
    viewPanel,
    editable: true,
    meta: { canEdit },
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
  });
  jest.spyOn(DashboardInteractions, 'panelActionClicked').mockImplementation();

  return { panel, dashboard };
}

function renderWrapper(panel: VizPanel, { isEditing = false, isViewPanel = false } = {}) {
  return render(
    <ElementSelectionContext.Provider
      value={{ enabled: isEditing, selected: [], onSelect: jest.fn(), onClear: jest.fn() }}
    >
      <PanelHoverActionsWrapper panel={panel} isViewPanel={isViewPanel}>
        <div data-testid="reference-child">panel</div>
      </PanelHoverActionsWrapper>
    </ElementSelectionContext.Provider>
  );
}

function buttonNames() {
  return screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'));
}

describe('PanelHoverActionsWrapper', () => {
  beforeEach(() => {
    mockTryGetExploreUrl.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('when viewing the dashboard', () => {
    it('shows maximize, edit, share and more, in that order', async () => {
      const { panel } = setup();
      renderWrapper(panel);

      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(buttonNames()).toEqual(['View panel', 'Edit', 'Share link', 'More actions']);
    });

    it('maximizes the panel when the user clicks View panel', async () => {
      const { panel } = setup();
      renderWrapper(panel);

      await hoverAndRest(screen.getByTestId('reference-child'));
      fireEvent.click(screen.getByRole('button', { name: 'View panel' }));

      expect(mockPartial).toHaveBeenCalledWith({ viewPanel: 'panel-1', editPanel: undefined });
      expect(DashboardInteractions.panelActionClicked).toHaveBeenCalledWith('maximize', 1, 'hover_popover');
    });

    it('opens panel edit when the user clicks Edit', async () => {
      const { panel } = setup();
      renderWrapper(panel);

      await hoverAndRest(screen.getByTestId('reference-child'));
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

      expect(mockPartial).toHaveBeenCalledWith({ editPanel: 1, viewPanel: undefined });
    });

    it('leaves out Edit when the user cannot edit the dashboard', async () => {
      const { panel } = setup({ canEdit: false });
      renderWrapper(panel);

      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(buttonNames()).toEqual(['View panel', 'Share link', 'More actions']);
    });

    it('shows Explore when the panel has an explore url and opens it on click', async () => {
      mockTryGetExploreUrl.mockResolvedValue('/explore?left=abc');
      const { panel } = setup();
      renderWrapper(panel);

      await hoverAndRest(screen.getByTestId('reference-child'));
      fireEvent.click(await screen.findByRole('button', { name: 'Explore' }));

      expect(mockPush).toHaveBeenCalledWith('/explore?left=abc');
      expect(DashboardInteractions.panelActionClicked).toHaveBeenCalledWith('explore', 1, 'hover_popover');
    });

    it('opens the panel menu from More actions', async () => {
      const { panel } = setup();
      renderWrapper(panel);

      await hoverAndRest(screen.getByTestId('reference-child'));
      fireEvent.click(screen.getByRole('button', { name: 'More actions' }));

      expect(await screen.findByRole('menuitem', { name: 'Inspect' })).toBeInTheDocument();
      expect(DashboardInteractions.panelActionClicked).toHaveBeenCalledWith('more', 1, 'hover_popover');
    });

    it('does not show a popover for a panel without a menu', async () => {
      const { panel } = setup({ withMenu: false });
      renderWrapper(panel);

      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(screen.getByTestId('reference-child')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'View panel' })).not.toBeInTheDocument();
    });
  });

  describe('when a panel is maximized', () => {
    it('swaps maximize for restore', async () => {
      const { panel } = setup({ viewPanel: 'panel-1' });
      renderWrapper(panel, { isViewPanel: true });

      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(buttonNames()).toEqual(['Back to dashboard', 'Edit', 'Share link', 'More actions']);
    });

    it('goes back to the dashboard when the user clicks Back to dashboard', async () => {
      const { panel } = setup({ viewPanel: 'panel-1' });
      renderWrapper(panel, { isViewPanel: true });

      await hoverAndRest(screen.getByTestId('reference-child'));
      fireEvent.click(screen.getByRole('button', { name: 'Back to dashboard' }));

      expect(mockPartial).toHaveBeenCalledWith({ viewPanel: null });
      expect(DashboardInteractions.panelActionClicked).toHaveBeenCalledWith('restore', 1, 'hover_popover');
    });

    it('shows the restore set in edit mode too', async () => {
      const { panel } = setup({ viewPanel: 'panel-1', isEditing: true });
      renderWrapper(panel, { isViewPanel: true, isEditing: true });

      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(screen.getByRole('button', { name: 'Back to dashboard' })).toBeInTheDocument();
    });
  });

  it('does not show a popover on the solo panel page, which renders through the view panel path', async () => {
    const { panel } = setup();
    renderWrapper(panel, { isViewPanel: true });

    await hoverAndRest(screen.getByTestId('reference-child'));

    expect(screen.getByTestId('reference-child')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View panel' })).not.toBeInTheDocument();
  });

  describe('when editing the dashboard', () => {
    it('shows settings, edit visualization, copy, duplicate, delete and more, in that order', async () => {
      const { panel } = setup({ isEditing: true });
      renderWrapper(panel, { isEditing: true });

      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(buttonNames()).toEqual([
        'Settings',
        'Edit visualization',
        'Copy to clipboard',
        'Duplicate',
        'Delete',
        'More actions',
      ]);
    });

    it('reports edit actions with the hover popover as source', async () => {
      const { panel } = setup({ isEditing: true });
      renderWrapper(panel, { isEditing: true });

      await hoverAndRest(screen.getByTestId('reference-child'));
      fireEvent.click(screen.getByRole('button', { name: 'Edit visualization' }));

      expect(mockPartial).toHaveBeenCalledWith({ editPanel: 1 });
      expect(DashboardInteractions.panelActionClicked).toHaveBeenCalledWith('configure', 1, 'hover_popover');
    });
  });
});

describe.each([
  { flag: true, shown: true },
  { flag: false, shown: false },
])('PanelEditActionsWrapper with grafana.panelHoverActions $flag', ({ flag, shown }) => {
  beforeAll(() => {
    setTestFlags({ [FlagKeys.GrafanaPanelHoverActions]: flag });
  });

  afterAll(() => {
    setTestFlags({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it(`${shown ? 'shows' : 'does not show'} panel actions outside edit mode`, async () => {
    mockTryGetExploreUrl.mockResolvedValue(undefined);
    const { panel } = setup();

    render(
      <PanelEditActionsWrapper panel={panel}>
        <div data-testid="reference-child">panel</div>
      </PanelEditActionsWrapper>
    );
    await hoverAndRest(screen.getByTestId('reference-child'));

    expect(screen.getByTestId('reference-child')).toBeInTheDocument();
    expect(Boolean(screen.queryByRole('button', { name: 'View panel' }))).toBe(shown);
  });
});
