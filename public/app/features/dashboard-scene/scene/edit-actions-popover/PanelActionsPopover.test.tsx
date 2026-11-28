import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { Subscription } from 'rxjs';
import { act, render, screen, userEvent, waitFor, within } from 'test/test-utils';

import { presetsQuickEdit } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { locationService, setPluginImportUtils } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { AdHocFiltersVariable, SceneVariableSet, VizPanel, VizPanelMenu } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { Dropdown, ElementSelectionContext, IconButton, Menu } from '@grafana/ui';
import { PanelChromeHeaderControlsContext } from '@grafana/ui/internal';
import { appEvents } from 'app/core/app_events';
import { setMobileViewport } from 'app/features/dashboard-scene/utils/mobileViewportTestUtils';
import { ShowConfirmModalEvent } from 'app/types/events';

import { ComposerSession } from '../../composer/ComposerSession';
import { transformSceneToSaveModel } from '../../serialization/transformSceneToSaveModel';
import { getCloneKey } from '../../utils/clone';
import { DashboardInteractions } from '../../utils/interactions';
import { activateFullSceneTree } from '../../utils/test-utils';
import { tryGetExploreUrlForPanel } from '../../utils/urlBuilders';
import { DashboardScene } from '../DashboardScene';
import { VizPanelHeaderActions } from '../VizPanelHeaderActions';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';

import { WAIT_FOR_MOUSE_REST_DURATION_MS } from './EditActionsPopover';
import { usePanelActionsOverlayOpenChange } from './PanelActionsOverlayContext';
import { PanelActionsWrapper } from './PanelActionsPopover';

jest.mock('app/core/app_events', () => ({
  appEvents: {
    subscribe: jest.fn(),
    publish: jest.fn(),
  },
}));
const mockPublishAppEvent = jest.mocked(appEvents.publish);

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    ...jest.requireActual('@grafana/runtime').locationService,
    partial: jest.fn(),
  },
}));
const mockLocationServicePartial = jest.mocked(locationService.partial);

// jsdom has no hover media features, which would turn off the edit actions used when the flag is off.
jest.mock('./EditActionsPopover', () => ({
  ...jest.requireActual('./EditActionsPopover'),
  useHoverPopoverSupported: () => true,
}));

jest.mock('../../utils/urlBuilders', () => ({
  ...jest.requireActual('../../utils/urlBuilders'),
  tryGetExploreUrlForPanel: jest.fn(() => Promise.resolve('/explore?left=panel-1')),
}));

async function hoverAndRest(element: HTMLElement) {
  jest.useFakeTimers();
  try {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.hover(element);
    await act(async () => {
      jest.advanceTimersByTime(WAIT_FOR_MOUSE_REST_DURATION_MS);
    });
  } finally {
    jest.useRealTimers();
  }
}

async function setPanelActionsPopoverFlag(value: boolean) {
  await act(async () => {
    setTestFlags({ [FlagKeys.GrafanaPanelActionsPopover]: value });
  });
}

function createPanel(overrides: Partial<ConstructorParameters<typeof VizPanel>[0]> = {}) {
  return new VizPanel({
    title: 'Test panel',
    pluginId: 'timeseries',
    key: 'panel-1',
    menu: new VizPanelMenu({ items: [{ text: 'Inspect' }] }),
    ...overrides,
  });
}

function createDashboard(panel: VizPanel, state: Partial<ConstructorParameters<typeof DashboardScene>[0]> = {}) {
  return new DashboardScene({
    editable: true,
    meta: { canEdit: true, canSave: true },
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
    ...state,
  });
}

function buildDashboardWithRepeatedRow() {
  const panel = createPanel();
  const row = new RowItem({
    key: 'row-1',
    layout: DefaultGridLayoutManager.fromVizPanels([panel]),
  });
  const cloneKey = getCloneKey('row-1', 1);
  const repeatedRow = row.clone({
    key: cloneKey,
    repeatSourceKey: 'row-1',
    layout: row.getLayout().cloneLayout(cloneKey, false),
  });
  row.setState({ repeatedRows: [repeatedRow] });
  const dashboard = new DashboardScene({
    editable: true,
    meta: { canEdit: true, canSave: true },
    isEditing: true,
    body: new RowsLayoutManager({ rows: [row] }),
  });

  return { dashboard, panel: repeatedRow.getLayout().getVizPanels()[0] };
}

/** Stands in for PanelChrome rendering a hover header item into the slot provided by the popover. */
function HoverHeaderItem({ isEmpty = false }: { isEmpty?: boolean }) {
  const headerControls = useContext(PanelChromeHeaderControlsContext);
  // An empty wrapper stands in for header items that render nothing, like panel links on a panel without links.
  const item = isEmpty ? <div /> : <span>Panel links</span>;
  return headerControls?.hoverSlot ? createPortal(item, headerControls.hoverSlot) : null;
}

/** Stands in for PanelChrome rendering the drag handle into its own slot. */
function DragHandleItem() {
  const headerControls = useContext(PanelChromeHeaderControlsContext);
  return headerControls?.dragHandleSlot
    ? createPortal(
        <button aria-label="Drag handle">
          <svg />
        </button>,
        headerControls.dragHandleSlot
      )
    : null;
}

/** Stands in for a hover header item with its own portalled menu, like the panel links dropdown. */
function HoverHeaderLinksMenu({ onLinkClick }: { onLinkClick: () => void }) {
  const headerControls = useContext(PanelChromeHeaderControlsContext);
  const onMenuOpenChange = usePanelActionsOverlayOpenChange();

  if (!headerControls?.hoverSlot) {
    return null;
  }

  return createPortal(
    <Dropdown
      overlay={
        <Menu>
          <Menu.Item label="Runbook" onClick={onLinkClick} />
        </Menu>
      }
      onVisibleChange={onMenuOpenChange}
    >
      <IconButton name="external-link-alt" aria-label="Open panel links" />
    </Dropdown>,
    headerControls.hoverSlot
  );
}

function renderWrapper(
  panel: VizPanel,
  {
    isEditing = false,
    onLinkClick,
    hasEmptyHeaderItem = false,
    hasDragHandle = false,
    selected = [],
  }: {
    isEditing?: boolean;
    onLinkClick?: () => void;
    hasEmptyHeaderItem?: boolean;
    hasDragHandle?: boolean;
    selected?: Array<{ id: string }>;
  } = {}
) {
  return render(
    <ElementSelectionContext.Provider value={{ enabled: isEditing, selected, onSelect: jest.fn(), onClear: jest.fn() }}>
      <PanelActionsWrapper panel={panel}>
        <div data-testid="reference-child">
          panel
          {onLinkClick ? (
            <HoverHeaderLinksMenu onLinkClick={onLinkClick} />
          ) : (
            <HoverHeaderItem isEmpty={hasEmptyHeaderItem} />
          )}
          {hasDragHandle && <DragHandleItem />}
        </div>
      </PanelActionsWrapper>
    </ElementSelectionContext.Provider>
  );
}

const getToolbar = () => screen.getByRole('toolbar', { name: 'Panel actions' });
/** Toolbar buttons in order, with each separator shown as '|'. */
const getToolbarLayout = () =>
  Array.from(getToolbar().querySelectorAll('button, a, [role="separator"]')).map((element) =>
    element.getAttribute('role') === 'separator' ? '|' : element.getAttribute('aria-label')
  );

describe('<PanelActionsWrapper />', () => {
  afterEach(async () => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    await act(async () => {
      setTestFlags({});
    });
  });

  describe('when grafana.panelActionsPopover is off', () => {
    test('in edit mode, the panel edit actions are shown instead of the panel actions popover', async () => {
      await setPanelActionsPopoverFlag(false);
      const panel = createPanel();
      createDashboard(panel, { isEditing: true });

      renderWrapper(panel, { isEditing: true });
      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(screen.getByRole('button', { name: 'Edit visualization' })).toBeInTheDocument();
      expect(screen.queryByRole('toolbar', { name: 'Panel actions' })).not.toBeInTheDocument();
    });
  });

  describe('when grafana.panelActionsPopover is on', () => {
    beforeEach(async () => {
      await setPanelActionsPopoverFlag(true);
    });

    test('in view mode, Edit, Explore, Expand and More actions are shown, with Edit and Explore grouped', async () => {
      const panel = createPanel();
      createDashboard(panel);

      renderWrapper(panel);
      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(await within(getToolbar()).findByRole('link', { name: 'Explore (p x)' })).toBeInTheDocument();
      expect(getToolbarLayout()).toEqual([
        'Edit visualization (e)',
        'Explore (p x)',
        '|',
        'Expand (v)',
        'More actions',
      ]);
    });

    test('in view mode on a small screen with mobile edit deprecation, Edit is not shown, like in the panel menu', async () => {
      await act(async () => {
        setTestFlags({ [FlagKeys.GrafanaPanelActionsPopover]: true, [FlagKeys.GrafanaMobileEditDeprecation]: true });
      });
      setMobileViewport();
      const panel = createPanel();
      createDashboard(panel);

      renderWrapper(panel);
      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(await within(getToolbar()).findByRole('link', { name: 'Explore (p x)' })).toBeInTheDocument();
      expect(getToolbarLayout()).toEqual(['Explore (p x)', '|', 'Expand (v)', 'More actions']);
    });

    test('in edit mode, Edit, Settings, Duplicate, Remove, Expand and More actions are shown in groups', async () => {
      const panel = createPanel();
      createDashboard(panel, { isEditing: true });

      renderWrapper(panel, { isEditing: true });
      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(getToolbarLayout()).toEqual([
        'Edit visualization (e)',
        'Panel settings',
        '|',
        'Duplicate',
        'Remove (p r)',
        '|',
        'Expand (v)',
        'More actions',
      ]);
    });

    test('in view mode, without Edit or Explore, only Expand and More actions are shown, without separators', async () => {
      jest.mocked(tryGetExploreUrlForPanel).mockResolvedValueOnce(undefined);
      const panel = createPanel();
      createDashboard(panel, { editable: false });

      renderWrapper(panel);
      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(getToolbarLayout()).toEqual(['Expand (v)', 'More actions']);
    });

    test('when the dashboard cannot be edited, Edit is not shown', async () => {
      const panel = createPanel();
      createDashboard(panel, { editable: false });

      renderWrapper(panel);
      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(within(getToolbar()).queryByRole('button', { name: 'Edit visualization (e)' })).not.toBeInTheDocument();
    });

    test('in composer mode, Edit is not shown, like in the panel menu', async () => {
      const panel = createPanel();
      createDashboard(panel, { mode: 'composer', isEditing: true });

      renderWrapper(panel);
      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(within(getToolbar()).queryByRole('button', { name: 'Edit visualization (e)' })).not.toBeInTheDocument();
    });

    function createRepeatedPanel({ isEditing }: { isEditing: boolean }) {
      const sourcePanel = createPanel({ key: 'panel-1' });
      const clonedPanel = createPanel({ key: getCloneKey('panel-1', 1), repeatSourceKey: 'panel-1' });
      new DashboardScene({
        editable: true,
        isEditing,
        meta: { canEdit: true, canSave: true },
        body: DefaultGridLayoutManager.fromGridItems([
          new DashboardGridItem({ body: sourcePanel, repeatedPanels: [clonedPanel] }),
        ]),
      });
      return clonedPanel;
    }

    test('in view mode, repeated panels show Edit disabled with the reason', async () => {
      renderWrapper(createRepeatedPanel({ isEditing: false }));
      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(getToolbarLayout()).toEqual([
        "Repeated panels can't be edited individually",
        'Explore (p x)',
        '|',
        'Expand (v)',
        'More actions',
      ]);
      expect(
        within(getToolbar()).getByRole('button', { name: "Repeated panels can't be edited individually" })
      ).toBeDisabled();
    });

    test('in edit mode, repeated panels show Edit, Duplicate and Remove disabled with the reason', async () => {
      renderWrapper(createRepeatedPanel({ isEditing: true }), { isEditing: true });
      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(getToolbarLayout()).toEqual([
        "Repeated panels can't be edited individually",
        'Panel settings',
        '|',
        "Repeated panels can't be duplicated individually",
        "Repeated panels can't be removed individually",
        '|',
        'Expand (v)',
        'More actions',
      ]);
      const toolbar = within(getToolbar());
      expect(toolbar.getByRole('button', { name: "Repeated panels can't be edited individually" })).toBeDisabled();
      expect(toolbar.getByRole('button', { name: "Repeated panels can't be duplicated individually" })).toBeDisabled();
      expect(toolbar.getByRole('button', { name: "Repeated panels can't be removed individually" })).toBeDisabled();
    });

    test('clicking Expand views the panel and reports the click', async () => {
      const panel = createPanel();
      createDashboard(panel);
      jest.spyOn(DashboardInteractions, 'panelActionClicked').mockImplementation();
      const user = userEvent.setup();

      renderWrapper(panel);
      await hoverAndRest(screen.getByTestId('reference-child'));
      await user.click(within(getToolbar()).getByRole('button', { name: 'Expand (v)' }));

      expect(mockLocationServicePartial).toHaveBeenCalledWith({ viewPanel: panel.getPathId(), editPanel: undefined });
      expect(DashboardInteractions.panelActionClicked).toHaveBeenCalledWith('view', 1, 'actions_popover', 'timeseries');
    });

    test('when the panel is expanded, Restore size returns to the dashboard', async () => {
      const panel = createPanel();
      createDashboard(panel, { viewPanel: 'panel-1' });
      jest.spyOn(DashboardInteractions, 'panelActionClicked').mockImplementation();
      const user = userEvent.setup();

      renderWrapper(panel);
      await hoverAndRest(screen.getByTestId('reference-child'));
      await user.click(within(getToolbar()).getByRole('button', { name: 'Restore size (v)' }));

      expect(mockLocationServicePartial).toHaveBeenCalledWith({ viewPanel: undefined });
      expect(DashboardInteractions.panelActionClicked).toHaveBeenCalledWith(
        'restore',
        1,
        'actions_popover',
        'timeseries'
      );
    });

    test('clicking Edit opens the panel editor and reports the panel type', async () => {
      const panel = createPanel();
      createDashboard(panel);
      jest.spyOn(DashboardInteractions, 'panelActionClicked').mockImplementation();
      const user = userEvent.setup();

      renderWrapper(panel);
      await hoverAndRest(screen.getByTestId('reference-child'));
      await user.click(within(getToolbar()).getByRole('button', { name: 'Edit visualization (e)' }));

      expect(mockLocationServicePartial).toHaveBeenCalledWith({ editPanel: 1, viewPanel: undefined });
      expect(DashboardInteractions.panelActionClicked).toHaveBeenCalledWith('edit', 1, 'actions_popover', 'timeseries');
    });

    test('Explore links to the panel queries in Explore, and clicking it is reported', async () => {
      const panel = createPanel();
      createDashboard(panel);
      const user = userEvent.setup();
      jest.spyOn(DashboardInteractions, 'panelActionClicked').mockImplementation();
      // jsdom can't navigate, so stand in for Grafana's app-wide link handling.
      const preventNavigation = (event: Event) => event.preventDefault();
      document.addEventListener('click', preventNavigation);

      renderWrapper(panel);
      await hoverAndRest(screen.getByTestId('reference-child'));
      const link = await within(getToolbar()).findByRole('link', { name: 'Explore (p x)' });
      expect(link).toHaveAttribute('href', '/explore?left=panel-1');

      await user.click(link);
      document.removeEventListener('click', preventNavigation);

      expect(DashboardInteractions.panelActionClicked).toHaveBeenCalledWith(
        'explore',
        1,
        'actions_popover',
        'timeseries'
      );
    });

    test('when explicit sidebar opening is enabled, clicking Settings opens the panel settings', async () => {
      setTestFlags({
        [FlagKeys.GrafanaPanelActionsPopover]: true,
        [FlagKeys.GrafanaDashboardSidebarExplicitOpen]: true,
      });
      const panel = createPanel();
      const dashboard = createDashboard(panel, { isEditing: true });
      const user = userEvent.setup();

      renderWrapper(panel, { isEditing: true });
      await hoverAndRest(screen.getByTestId('reference-child'));
      await user.click(within(getToolbar()).getByRole('button', { name: 'Panel settings' }));

      expect(dashboard.state.sidebar.getSelectedObject()).toBe(panel);
      expect(dashboard.state.sidebar.state.openPane?.getId()).toBe('element');
    });

    test('when explicit sidebar opening is enabled, Settings in a repeated row opens the source panel settings', async () => {
      setTestFlags({
        [FlagKeys.GrafanaPanelActionsPopover]: true,
        [FlagKeys.GrafanaDashboardSidebarExplicitOpen]: true,
      });
      const { dashboard, panel } = buildDashboardWithRepeatedRow();
      const user = userEvent.setup();

      renderWrapper(panel, { isEditing: true });
      await hoverAndRest(screen.getByTestId('reference-child'));
      await user.click(within(getToolbar()).getByRole('button', { name: 'Panel settings' }));

      expect(dashboard.state.sidebar.getSelectedObject()?.state.key).toBe('panel-1');
      expect(dashboard.state.sidebar.state.openPane?.getId()).toBe('element');
    });

    test('clicking Duplicate duplicates the panel via the dashboard', async () => {
      const panel = createPanel();
      const dashboard = createDashboard(panel, { isEditing: true });
      const duplicatePanel = jest.spyOn(dashboard, 'duplicatePanel').mockImplementation();
      const user = userEvent.setup();

      renderWrapper(panel, { isEditing: true });
      await hoverAndRest(screen.getByTestId('reference-child'));
      await user.click(within(getToolbar()).getByRole('button', { name: 'Duplicate' }));

      expect(duplicatePanel).toHaveBeenCalledWith(panel);
    });

    test('confirming Remove of an expanded panel removes it and returns to the dashboard', async () => {
      const panel = createPanel();
      const dashboard = createDashboard(panel, { isEditing: true, viewPanel: 'panel-1' });
      const removePanel = jest.spyOn(dashboard, 'removePanel').mockImplementation();
      const user = userEvent.setup();

      renderWrapper(panel, { isEditing: true });
      await hoverAndRest(screen.getByTestId('reference-child'));
      await user.click(within(getToolbar()).getByRole('button', { name: 'Remove (p r)' }));

      expect(removePanel).not.toHaveBeenCalled();
      const [event] = mockPublishAppEvent.mock.calls[0];
      expect(event).toBeInstanceOf(ShowConfirmModalEvent);
      expect(event.payload.title).toBe('Remove panel');

      act(() => event.payload.onConfirm());

      expect(removePanel).toHaveBeenCalledWith(panel);
      expect(mockLocationServicePartial).toHaveBeenCalledWith({ viewPanel: undefined });
    });

    test('More actions opens the panel menu and keeps the popover open while it shows', async () => {
      const panel = createPanel();
      createDashboard(panel);
      const user = userEvent.setup();

      renderWrapper(panel);
      await hoverAndRest(screen.getByTestId('reference-child'));
      const moreActions = within(getToolbar()).getByTestId(selectors.components.Panels.Panel.menu('Test panel'));
      await user.click(moreActions);

      expect(await screen.findByRole('menuitem', { name: 'Inspect' })).toBeInTheDocument();

      await user.unhover(screen.getByTestId('reference-child'));
      await user.hover(screen.getByRole('menuitem', { name: 'Inspect' }));

      // The open menu hides everything else from assistive technology, including the popover.
      expect(screen.getByRole('toolbar', { name: 'Panel actions', hidden: true })).toBeInTheDocument();
    });

    test('a menu opened from a hover header item keeps the popover open until its item is clicked', async () => {
      const panel = createPanel({ title: '', hoverHeader: true });
      createDashboard(panel);
      const onLinkClick = jest.fn();
      const user = userEvent.setup();

      renderWrapper(panel, { onLinkClick });
      await hoverAndRest(screen.getByTestId('reference-child'));
      await user.click(within(getToolbar()).getByRole('button', { name: 'Open panel links' }));
      await user.unhover(screen.getByTestId('reference-child'));
      await user.click(await screen.findByRole('menuitem', { name: 'Runbook' }));

      expect(onLinkClick).toHaveBeenCalledTimes(1);
    });

    test('a menu opened from a hover header item can be used with the keyboard', async () => {
      const panel = createPanel({ title: '', hoverHeader: true });
      createDashboard(panel);
      const onLinkClick = jest.fn();
      const user = userEvent.setup();

      renderWrapper(panel, { onLinkClick });
      await hoverAndRest(screen.getByTestId('reference-child'));
      within(getToolbar()).getByRole('button', { name: 'Open panel links' }).focus();
      await user.keyboard('{Enter}');
      await screen.findByRole('menuitem', { name: 'Runbook' });
      await user.keyboard('{ArrowDown}{Enter}');

      expect(onLinkClick).toHaveBeenCalledTimes(1);
    });

    test('Group by opened from the menu shows the panel keys and keeps the popover open', async () => {
      jest
        .spyOn(AdHocFiltersVariable.prototype, '_getGroupByKeys')
        .mockResolvedValue([{ label: 'host', value: 'host' }]);
      const headerActions = new VizPanelHeaderActions({ isGroupByActionSupported: true });
      const panel = createPanel({
        headerActions,
        menu: new VizPanelMenu({ items: [{ text: 'Group by…', onClick: () => headerActions.openGroupByPicker() }] }),
      });
      createDashboard(panel, {
        $variables: new SceneVariableSet({
          variables: [new AdHocFiltersVariable({ name: 'filters', enableGroupBy: true, filters: [] })],
        }),
      });
      const user = userEvent.setup();

      renderWrapper(panel);
      await hoverAndRest(screen.getByTestId('reference-child'));
      await user.click(within(getToolbar()).getByRole('button', { name: 'More actions' }));
      // Clicking the item closes the menu and opens the picker in the same event.
      await user.click(await screen.findByRole('menuitem', { name: 'Group by…' }));

      expect(await screen.findByRole('checkbox', { name: 'host' })).toBeInTheDocument();
      expect(screen.getByRole('toolbar', { name: 'Panel actions', hidden: true })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(headerActions.state.isGroupByPickerOpen).toBe(false);
    });

    test('Escape in the Group by picker closes only the picker and returns focus to More actions', async () => {
      jest
        .spyOn(AdHocFiltersVariable.prototype, '_getGroupByKeys')
        .mockResolvedValue([{ label: 'host', value: 'host' }]);
      const headerActions = new VizPanelHeaderActions({ isGroupByActionSupported: true });
      const panel = createPanel({
        headerActions,
        menu: new VizPanelMenu({ items: [{ text: 'Group by…', onClick: () => headerActions.openGroupByPicker() }] }),
      });
      createDashboard(panel, {
        $variables: new SceneVariableSet({
          variables: [new AdHocFiltersVariable({ name: 'filters', enableGroupBy: true, filters: [] })],
        }),
      });
      const user = userEvent.setup();

      renderWrapper(panel);
      await hoverAndRest(screen.getByTestId('reference-child'));
      await user.click(within(getToolbar()).getByRole('button', { name: 'More actions' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Group by…' }));
      act(() => screen.getByRole('checkbox', { name: 'host' }).focus());
      await user.keyboard('{Escape}');

      expect(headerActions.state.isGroupByPickerOpen).toBe(false);
      expect(screen.queryByRole('checkbox', { name: 'host' })).not.toBeInTheDocument();
      expect(within(getToolbar()).getByRole('button', { name: 'More actions' })).toHaveFocus();
    });

    test('for a panel with a hover header, its header items are rendered first in the popover', async () => {
      const panel = createPanel({ title: '', hoverHeader: true });
      createDashboard(panel);

      renderWrapper(panel);
      await hoverAndRest(screen.getByTestId('reference-child'));

      const toolbar = getToolbar();
      expect(within(toolbar).getByText('Panel links')).toBeInTheDocument();
      expect(toolbar.firstElementChild).toContainElement(within(toolbar).getByText('Panel links'));
    });

    test('for a panel with a hover header, a separator sits between its header items and the panel actions', async () => {
      const panel = createPanel({ title: '', hoverHeader: true });
      createDashboard(panel);

      renderWrapper(panel);
      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(getToolbarLayout().slice(0, 2)).toEqual(['|', 'Edit visualization (e)']);
    });

    test('for a panel with a hover header whose items render nothing, no separator comes before the panel actions', async () => {
      const panel = createPanel({ title: '', hoverHeader: true });
      createDashboard(panel);

      renderWrapper(panel, { hasEmptyHeaderItem: true });
      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(getToolbarLayout()[0]).toBe('Edit visualization (e)');
    });

    test('for a panel with a hover header, its drag handle sits right before Expand, after the separator', async () => {
      const panel = createPanel({ title: '', hoverHeader: true });
      createDashboard(panel, { isEditing: true });

      renderWrapper(panel, { isEditing: true, hasDragHandle: true });
      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(getToolbarLayout().slice(-4)).toEqual(['|', 'Drag handle', 'Expand (v)', 'More actions']);
    });

    test('in edit mode, when the panel is one of several selected panels, the actions for the selection are shown', async () => {
      const panel = createPanel();
      const otherPanel = createPanel({ key: 'panel-2', title: 'Other panel' });
      new DashboardScene({
        editable: true,
        meta: { canEdit: true, canSave: true },
        isEditing: true,
        body: DefaultGridLayoutManager.fromVizPanels([panel, otherPanel]),
      });

      renderWrapper(panel, { isEditing: true, selected: [{ id: 'panel-1' }, { id: 'panel-2' }] });
      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(within(getToolbar()).getByText('2 panels selected')).toBeInTheDocument();
      expect(getToolbarLayout()).toEqual(['Group into row', 'Group into tab', 'Delete']);
    });

    test('in edit mode, when an untitled panel without a drag handle is one of several selected panels, no separator trails the actions', async () => {
      const panel = createPanel({ title: '', hoverHeader: true });
      const otherPanel = createPanel({ key: 'panel-2', title: 'Other panel' });
      new DashboardScene({
        editable: true,
        meta: { canEdit: true, canSave: true },
        isEditing: true,
        body: DefaultGridLayoutManager.fromVizPanels([panel, otherPanel]),
      });

      renderWrapper(panel, { isEditing: true, selected: [{ id: 'panel-1' }, { id: 'panel-2' }] });
      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(getToolbarLayout()).toEqual(['|', 'Group into row', 'Group into tab', 'Delete']);
    });

    test('in edit mode, when an untitled panel is one of several selected panels, its header items and drag handle stay', async () => {
      const panel = createPanel({ title: '', hoverHeader: true });
      const otherPanel = createPanel({ key: 'panel-2', title: 'Other panel' });
      new DashboardScene({
        editable: true,
        meta: { canEdit: true, canSave: true },
        isEditing: true,
        body: DefaultGridLayoutManager.fromVizPanels([panel, otherPanel]),
      });

      renderWrapper(panel, { isEditing: true, hasDragHandle: true, selected: [{ id: 'panel-1' }, { id: 'panel-2' }] });
      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(within(getToolbar()).getByText('Panel links')).toBeInTheDocument();
      expect(getToolbarLayout()).toEqual(['|', 'Group into row', 'Group into tab', 'Delete', '|', 'Drag handle']);
    });

    test('in edit mode, when only this panel is selected, the single panel actions are shown', async () => {
      const panel = createPanel();
      createDashboard(panel, { isEditing: true });

      renderWrapper(panel, { isEditing: true, selected: [{ id: 'panel-1' }] });
      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(within(getToolbar()).getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();
      expect(within(getToolbar()).queryByRole('button', { name: 'Group into row' })).not.toBeInTheDocument();
    });

    test('for a panel without a menu, e.g. on a public dashboard, no popover is shown', async () => {
      const panel = createPanel({ menu: undefined });
      createDashboard(panel);

      renderWrapper(panel);
      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(screen.queryByRole('toolbar', { name: 'Panel actions' })).not.toBeInTheDocument();
    });

    describe('with quick edits', () => {
      // Lets a test make the plugin stop offering the Legend quick edit, as a plugin can as the panel changes.
      let offersLegend = true;
      const withQuickEdits = getPanelPlugin({ id: 'with-quick-edits' })
        .setPanelOptions((builder) =>
          builder.addBooleanSwitch({
            path: 'legend.showLegend',
            name: 'Visibility',
            category: ['Legend'],
            defaultValue: true,
          })
        )
        .setPresetsSupplier(() => [])
        .setQuickEdits(() => [
          ...(offersLegend
            ? [
                {
                  id: 'legend',
                  title: 'Legend',
                  icon: 'list-ul' as const,
                  optionIds: ['legend.showLegend'],
                  summary: ({ options }: { options: { legend: { showLegend: boolean } } }) => ({
                    text: options.legend.showLegend ? 'Shown' : 'Hidden',
                  }),
                },
              ]
            : []),
          presetsQuickEdit(),
        ]);
      let deactivate: (() => void) | undefined;

      beforeAll(() => {
        setPluginImportUtils({
          importPanelPlugin: async () => withQuickEdits,
          getPanelPluginFromCache: (id) => (id === withQuickEdits.meta.id ? withQuickEdits : undefined),
        });
      });

      beforeEach(async () => {
        // The active dashboard applies the edits, and its keyboard shortcuts unsubscribe from app events on deactivate.
        jest.mocked(appEvents.subscribe).mockReturnValue(new Subscription());
        await act(async () => {
          setTestFlags({ [FlagKeys.GrafanaPanelActionsPopover]: true, [FlagKeys.GrafanaPanelQuickEdits]: true });
        });
      });

      afterEach(async () => {
        // In act, as leaving the dashboard ends Composer, which changes the actions, and the lookups they start.
        await act(async () => deactivate?.());
        deactivate = undefined;
        offersLegend = true;
      });

      async function renderWithQuickEdits(state: { isEditing: boolean } & Parameters<typeof createDashboard>[1]) {
        const panel = createPanel({ pluginId: 'with-quick-edits', options: { legend: { showLegend: true } } });
        const dashboard = createDashboard(panel, state);
        // Leaving Composer compares the dashboard with the version it loaded.
        dashboard.setInitialSaveModel(transformSceneToSaveModel(dashboard));
        deactivate = activateFullSceneTree(dashboard);
        return { ...(await hoverPanel(panel, state.isEditing)), dashboard };
      }

      async function hoverPanel(panel: VizPanel, isSelectionEnabled: boolean) {
        renderWrapper(panel, { isEditing: isSelectionEnabled });
        await hoverAndRest(screen.getByTestId('reference-child'));
        return { panel, user: userEvent.setup() };
      }

      /**
       * Opens Composer over Editing or Viewing, optionally over the edit session kept from Editing. No pick is pending,
       * as with the Assistant's Pointer tool. Composer turns element selection off.
       */
      async function renderInComposer({
        over,
        keepsEditSession = false,
      }: {
        over: 'edit' | 'view';
        keepsEditSession?: boolean;
      }) {
        await act(async () => {
          setTestFlags({
            [FlagKeys.GrafanaPanelActionsPopover]: true,
            [FlagKeys.GrafanaPanelQuickEdits]: true,
            dashboardNewLayouts: true,
            [FlagKeys.GrafanaDashboardPreviewMode]: true,
            [FlagKeys.GrafanaDashboardComposer]: true,
          });
        });
        const panel = createPanel({ pluginId: 'with-quick-edits', options: { legend: { showLegend: true } } });
        const dashboard = createDashboard(panel, { uid: 'composer-test' });
        dashboard.setInitialSaveModel(transformSceneToSaveModel(dashboard));
        deactivate = activateFullSceneTree(dashboard);
        let session: ComposerSession | undefined;
        act(() => {
          if (over === 'edit' || keepsEditSession) {
            dashboard.setDashboardMode('edit');
          }
          session = ComposerSession.enter(dashboard);
          if (over === 'view' && keepsEditSession) {
            dashboard.setComposerEditing(false);
          }
        });
        const context = await hoverPanel(panel, false);
        // Explore is looked up as the actions show.
        expect(await within(getToolbar()).findByRole('link', { name: 'Explore (p x)' })).toBeInTheDocument();
        return { ...context, dashboard, session: session! };
      }

      async function hideLegendWithQuickEdits(user: ReturnType<typeof userEvent.setup>) {
        await user.click(within(getToolbar()).getByRole('button', { name: 'Quick edits' }));
        await user.click(within(getToolbar()).getByRole('button', { name: 'Legend: Shown' }));
        await user.click(
          within(screen.getByRole('dialog', { name: 'Legend' })).getByRole('switch', { name: 'Visibility' })
        );
      }

      test('in edit mode, Quick edits leads the panel actions', async () => {
        await renderWithQuickEdits({ isEditing: true });

        expect(getToolbarLayout().slice(0, 3)).toEqual(['Quick edits', 'Edit visualization (e)', 'Panel settings']);
      });

      test('in view mode, Quick edits is not shown', async () => {
        await renderWithQuickEdits({ isEditing: false });

        expect(within(getToolbar()).getByRole('button', { name: 'Expand (v)' })).toBeInTheDocument();
        expect(within(getToolbar()).queryByRole('button', { name: 'Quick edits' })).not.toBeInTheDocument();
      });

      test('in Composer with no pick pending, Quick edits leads the actions Composer leaves', async () => {
        await renderInComposer({ over: 'edit' });

        // The hidden quick edits' back button comes after the actions.
        expect(getToolbarLayout().slice(0, 5)).toEqual([
          'Quick edits',
          'Explore (p x)',
          '|',
          'Expand (v)',
          'More actions',
        ]);
      });

      test("in Composer, Quick edits is not shown while a pick is pending, as presses are Composer's then", async () => {
        const { session } = await renderInComposer({ over: 'edit' });
        const pick = new AbortController();

        act(() => void session.pickElement(pick.signal));
        expect(within(getToolbar()).getByRole('link', { name: 'Explore (p x)' })).toBeInTheDocument();
        expect(within(getToolbar()).queryByRole('button', { name: 'Quick edits' })).not.toBeInTheDocument();

        act(() => pick.abort());
        expect(within(getToolbar()).getByRole('button', { name: 'Quick edits' })).toBeInTheDocument();
      });

      test('in Composer over Editing, a quick edit changes the panel as an undoable edit', async () => {
        const { dashboard, panel, user } = await renderInComposer({ over: 'edit' });

        await hideLegendWithQuickEdits(user);

        expect(panel.state.options).toEqual({ legend: { showLegend: false } });
        expect(dashboard.state.sidebar.state.undoStack.map(({ description }) => description)).toEqual([
          'Legend: Visibility',
        ]);
        await waitFor(() => expect(dashboard.state.isDirty).toBe(true));
      });

      test.each([
        { name: 'without an edit session', keepsEditSession: false },
        { name: 'with the edit session kept from Editing', keepsEditSession: true },
      ])(
        'in Composer over Viewing $name, a quick edit changes the panel and Composer stays over Viewing',
        async ({ keepsEditSession }) => {
          const { dashboard, panel, user } = await renderInComposer({ over: 'view', keepsEditSession });

          await hideLegendWithQuickEdits(user);

          expect(panel.state.options).toEqual({ legend: { showLegend: false } });
          expect(dashboard.state).toMatchObject({ mode: 'composer', composerEditing: false });
          expect(Boolean(dashboard.state.isEditing)).toBe(keepsEditSession);
          expect(dashboard.state.sidebar.state.undoStack).toEqual([]);
          // An edit session kept from Editing still sees the change, so leaving Composer offers to save it.
          await waitFor(() => expect(Boolean(dashboard.state.isDirty)).toBe(keepsEditSession));
        }
      );

      test('Quick edits swaps the panel actions for the quick edits, which change the panel', async () => {
        const { panel, user } = await renderWithQuickEdits({ isEditing: true });

        await user.click(within(getToolbar()).getByRole('button', { name: 'Quick edits' }));
        expect(within(getToolbar()).getByRole('button', { name: 'More actions' }).closest('[inert]')).not.toBeNull();
        await user.click(within(getToolbar()).getByRole('button', { name: 'Legend: Shown' }));
        await user.click(
          within(screen.getByRole('dialog', { name: 'Legend' })).getByRole('switch', { name: 'Visibility' })
        );

        expect(panel.state.options).toEqual({ legend: { showLegend: false } });
        expect(within(getToolbar()).getByRole('button', { name: 'Legend: Hidden' })).toBeInTheDocument();
      });

      async function openLegendCard() {
        const context = await renderWithQuickEdits({ isEditing: true });
        await context.user.click(within(getToolbar()).getByRole('button', { name: 'Quick edits' }));
        await context.user.click(within(getToolbar()).getByRole('button', { name: 'Legend: Shown' }));
        return context;
      }

      test('closing a quick edit card with its close button keeps the popover open on its actions', async () => {
        const { user } = await openLegendCard();

        await user.click(within(screen.getByRole('dialog', { name: 'Legend' })).getByRole('button', { name: 'Close' }));

        expect(within(getToolbar()).getByRole('button', { name: 'Quick edits' })).toHaveFocus();
        expect(within(getToolbar()).getByRole('button', { name: 'Panel settings' }).closest('[inert]')).toBeNull();
      });

      test('Escape on a quick edit card the pointer is over keeps the popover open on its actions', async () => {
        const { user } = await openLegendCard();

        await user.hover(screen.getByRole('dialog', { name: 'Legend' }));
        await user.keyboard('{Escape}');

        expect(within(getToolbar()).getByRole('button', { name: 'Quick edits' })).toHaveFocus();
        expect(within(getToolbar()).getByRole('button', { name: 'Panel settings' }).closest('[inert]')).toBeNull();
      });

      test('after a quick edit card closes, the popover closes once the pointer moves off the panel', async () => {
        const { user } = await openLegendCard();
        await user.click(within(screen.getByRole('dialog', { name: 'Legend' })).getByRole('button', { name: 'Close' }));
        expect(getToolbar()).toBeInTheDocument();

        await user.hover(document.body);

        expect(screen.queryByRole('toolbar', { name: 'Panel actions' })).not.toBeInTheDocument();
      });

      test('when the open quick edit is no longer offered, the popover closes once the pointer moves off the panel', async () => {
        const { panel, user } = await openLegendCard();

        offersLegend = false;
        act(() => panel.onOptionsChange({ legend: { showLegend: false } }));
        expect(screen.queryByRole('dialog', { name: 'Legend' })).not.toBeInTheDocument();
        // From the bar, as the button the pointer was on went with the quick edit.
        await user.hover(getToolbar());
        await user.hover(document.body);

        expect(screen.queryByRole('toolbar', { name: 'Panel actions' })).not.toBeInTheDocument();
      });

      test('the panel is outlined while its quick edit card is open', async () => {
        const { user } = await renderWithQuickEdits({ isEditing: true });
        await user.click(within(getToolbar()).getByRole('button', { name: 'Quick edits' }));
        await user.click(within(getToolbar()).getByRole('button', { name: 'Legend: Shown' }));

        // Inside the panel, so it stays under the actions bar that overlaps the panel's top edge.
        expect(screen.getByTestId('reference-child')).toContainElement(screen.getByTestId('quick-edit-panel-outline'));

        await user.click(within(screen.getByRole('dialog', { name: 'Legend' })).getByRole('button', { name: 'Close' }));

        expect(screen.queryByTestId('quick-edit-panel-outline')).not.toBeInTheDocument();
      });
    });
  });
});
