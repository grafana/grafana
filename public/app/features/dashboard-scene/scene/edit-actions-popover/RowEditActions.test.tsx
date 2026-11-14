import { cleanup } from '@testing-library/react';
import { act, fireEvent, render, userEvent } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { ElementSelectionContext } from '@grafana/ui';

import { DashboardScene } from '../DashboardScene';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabItem } from '../layout-tabs/TabItem';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';

import { WAIT_FOR_MOUSE_REST_DURATION_MS } from './EditActionsPopover';
import { RowEditActionsWrapper } from './RowEditActions';

function renderRowEditActions(row = new RowItem({ title: 'Overview' })) {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  const result = render(
    <ElementSelectionContext.Provider value={{ enabled: true, selected: [], onSelect: jest.fn(), onClear: jest.fn() }}>
      <RowEditActionsWrapper row={row}>
        <button>Overview</button>
      </RowEditActionsWrapper>
    </ElementSelectionContext.Provider>
  );

  return {
    elements: {
      popover: () => result.queryByTestId(selectors.components.EditActionsPopover.container),
    },
    actions: {
      async hoverAndRest() {
        await user.hover(result.getByRole('button', { name: 'Overview' }));
        await act(async () => {
          jest.advanceTimersByTime(WAIT_FOR_MOUSE_REST_DURATION_MS);
        });
      },
      clickSettings() {
        fireEvent.click(result.getByRole('button', { name: 'Row settings' }));
      },
    },
  };
}

describe.each([
  { enabled: false, supportsHover: true },
  { enabled: true, supportsHover: true },
  { enabled: false, supportsHover: false },
  { enabled: true, supportsHover: false },
])('<RowEditActionsWrapper />: flag $enabled, hover $supportsHover', ({ enabled, supportsHover }) => {
  beforeEach(() => {
    setTestFlags({ 'grafana.dashboardSidebarExplicitOpen': enabled });
    jest.useFakeTimers();
    jest.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: supportsHover,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
  });

  afterEach(() => {
    cleanup();
    setTestFlags({});
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test(`when hovering a row in edit mode, its popover is ${enabled ? 'shown' : 'hidden'}`, async () => {
    const { elements, actions } = renderRowEditActions();

    await actions.hoverAndRest();

    if (enabled) {
      expect(elements.popover()).toBeInTheDocument();
    } else {
      expect(elements.popover()).not.toBeInTheDocument();
    }
  });
});

describe('<RowEditActionsWrapper /> settings', () => {
  beforeEach(() => {
    setTestFlags({ 'grafana.dashboardSidebarExplicitOpen': true });
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    setTestFlags({});
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('when the user clicks Row settings on a row inside a repeated tab, settings open for the source row', async () => {
    const sourceRow = new RowItem({ key: 'row-1', title: 'Overview' });
    const clonedRow = new RowItem({ key: 'row-1-clone', title: 'Overview' });
    const sourceTab = new TabItem({ key: 'tab-1', layout: new RowsLayoutManager({ rows: [sourceRow] }) });
    const clonedTab = new TabItem({
      key: 'tab-1-clone',
      repeatSourceKey: 'tab-1',
      layout: new RowsLayoutManager({ rows: [clonedRow] }),
    });
    sourceTab.setState({ repeatedTabs: [clonedTab] });
    const scene = new DashboardScene({ isEditing: true, body: new TabsLayoutManager({ tabs: [sourceTab] }) });
    const { actions } = renderRowEditActions(clonedRow);

    await actions.hoverAndRest();
    actions.clickSettings();

    expect(scene.state.sidebar.getSelectedObject()?.state.key).toBe('row-1');
  });
});
