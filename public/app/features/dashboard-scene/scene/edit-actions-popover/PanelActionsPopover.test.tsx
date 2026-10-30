import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { act, render, screen, userEvent, within } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { AdHocFiltersVariable, SceneVariableSet, VizPanel, VizPanelMenu } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { Dropdown, ElementSelectionContext, IconButton, Menu } from '@grafana/ui';
import { PanelChromeHeaderControlsContext } from '@grafana/ui/internal';
import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent } from 'app/types/events';

import { getCloneKey } from '../../utils/clone';
import { DashboardInteractions } from '../../utils/interactions';
import { tryGetExploreUrlForPanel } from '../../utils/urlBuilders';
import { DashboardScene } from '../DashboardScene';
import { VizPanelHeaderActions } from '../VizPanelHeaderActions';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';

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
    push: jest.fn(),
  },
}));
const mockLocationServicePartial = jest.mocked(locationService.partial);
const mockLocationServicePush = jest.mocked(locationService.push);

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
    ? createPortal(<button aria-label="Drag handle" />, headerControls.dragHandleSlot)
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
  }: { isEditing?: boolean; onLinkClick?: () => void; hasEmptyHeaderItem?: boolean; hasDragHandle?: boolean } = {}
) {
  return render(
    <ElementSelectionContext.Provider
      value={{ enabled: isEditing, selected: [], onSelect: jest.fn(), onClear: jest.fn() }}
    >
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
  Array.from(getToolbar().querySelectorAll('button, [role="separator"]')).map((element) =>
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

      expect(await within(getToolbar()).findByRole('button', { name: 'Explore (p x)' })).toBeInTheDocument();
      expect(getToolbarLayout()).toEqual(['Edit (e)', 'Explore (p x)', '|', 'Expand (v)', 'More actions']);
    });

    test('in edit mode, Edit, Settings, Copy, Duplicate, Remove, Expand and More actions are shown in groups', async () => {
      const panel = createPanel();
      createDashboard(panel, { isEditing: true });

      renderWrapper(panel, { isEditing: true });
      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(getToolbarLayout()).toEqual([
        'Edit (e)',
        'Settings',
        '|',
        'Copy to clipboard',
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

      expect(within(getToolbar()).queryByRole('button', { name: 'Edit (e)' })).not.toBeInTheDocument();
    });

    test('in edit mode, repeated panels do not offer Edit, Copy, Duplicate or Remove', async () => {
      const sourcePanel = createPanel({ key: 'panel-1' });
      const clonedPanel = createPanel({ key: getCloneKey('panel-1', 1), repeatSourceKey: 'panel-1' });
      new DashboardScene({
        editable: true,
        isEditing: true,
        meta: { canEdit: true, canSave: true },
        body: DefaultGridLayoutManager.fromGridItems([
          new DashboardGridItem({ body: sourcePanel, repeatedPanels: [clonedPanel] }),
        ]),
      });

      renderWrapper(clonedPanel, { isEditing: true });
      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(getToolbarLayout()).toEqual(['Settings', '|', 'Expand (v)', 'More actions']);
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
      expect(DashboardInteractions.panelActionClicked).toHaveBeenCalledWith('view', 1, 'actions_popover');
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
      expect(DashboardInteractions.panelActionClicked).toHaveBeenCalledWith('restore', 1, 'actions_popover');
    });

    test('clicking Edit opens the panel editor and reports the panel type', async () => {
      const panel = createPanel();
      createDashboard(panel);
      jest.spyOn(DashboardInteractions, 'panelActionClicked').mockImplementation();
      const user = userEvent.setup();

      renderWrapper(panel);
      await hoverAndRest(screen.getByTestId('reference-child'));
      await user.click(within(getToolbar()).getByRole('button', { name: 'Edit (e)' }));

      expect(mockLocationServicePartial).toHaveBeenCalledWith({ editPanel: 1, viewPanel: undefined });
      expect(DashboardInteractions.panelActionClicked).toHaveBeenCalledWith('edit', 1, 'actions_popover', 'timeseries');
    });

    test('clicking Explore opens the panel queries in Explore', async () => {
      const panel = createPanel();
      createDashboard(panel);
      const user = userEvent.setup();

      renderWrapper(panel);
      await hoverAndRest(screen.getByTestId('reference-child'));
      await user.click(await within(getToolbar()).findByRole('button', { name: 'Explore (p x)' }));

      expect(mockLocationServicePush).toHaveBeenCalledWith('/explore?left=panel-1');
    });

    test('clicking Settings selects the panel in the edit sidebar', async () => {
      const panel = createPanel();
      const dashboard = createDashboard(panel, { isEditing: true });
      const user = userEvent.setup();

      renderWrapper(panel, { isEditing: true });
      await hoverAndRest(screen.getByTestId('reference-child'));
      await user.click(within(getToolbar()).getByRole('button', { name: 'Settings' }));

      expect(dashboard.state.sidebar.getSelectedObject()).toBe(panel);
    });

    test('clicking Copy and Duplicate copy and duplicate the panel via the dashboard', async () => {
      const panel = createPanel();
      const dashboard = createDashboard(panel, { isEditing: true });
      const copyPanel = jest.spyOn(dashboard, 'copyPanel').mockImplementation();
      const duplicatePanel = jest.spyOn(dashboard, 'duplicatePanel').mockImplementation();
      const user = userEvent.setup();

      renderWrapper(panel, { isEditing: true });
      await hoverAndRest(screen.getByTestId('reference-child'));
      await user.click(within(getToolbar()).getByRole('button', { name: 'Copy to clipboard' }));
      await user.click(within(getToolbar()).getByRole('button', { name: 'Duplicate' }));

      expect(copyPanel).toHaveBeenCalledWith(panel);
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

      expect(getToolbarLayout().slice(0, 2)).toEqual(['|', 'Edit (e)']);
    });

    test('for a panel with a hover header whose items render nothing, no separator comes before the panel actions', async () => {
      const panel = createPanel({ title: '', hoverHeader: true });
      createDashboard(panel);

      renderWrapper(panel, { hasEmptyHeaderItem: true });
      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(getToolbarLayout()[0]).toBe('Edit (e)');
    });

    test('for a panel with a hover header, its drag handle sits right before Expand, after the separator', async () => {
      const panel = createPanel({ title: '', hoverHeader: true });
      createDashboard(panel, { isEditing: true });

      renderWrapper(panel, { isEditing: true, hasDragHandle: true });
      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(getToolbarLayout().slice(-4)).toEqual(['|', 'Drag handle', 'Expand (v)', 'More actions']);
    });

    test('for a panel without a menu, e.g. on a public dashboard, no popover is shown', async () => {
      const panel = createPanel({ menu: undefined });
      createDashboard(panel);

      renderWrapper(panel);
      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(screen.queryByRole('toolbar', { name: 'Panel actions' })).not.toBeInTheDocument();
    });
  });
});
