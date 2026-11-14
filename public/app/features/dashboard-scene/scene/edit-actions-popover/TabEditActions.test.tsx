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
import { TabEditActionsWrapper } from './TabEditActions';

function renderTabEditActions(tab = new TabItem({ title: 'Overview' })) {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  const result = render(
    <ElementSelectionContext.Provider value={{ enabled: true, selected: [], onSelect: jest.fn(), onClear: jest.fn() }}>
      <TabEditActionsWrapper tab={tab}>
        <button>Overview</button>
      </TabEditActionsWrapper>
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
        fireEvent.click(result.getByRole('button', { name: 'Tab settings' }));
      },
    },
  };
}

describe.each([
  { enabled: false, supportsHover: true },
  { enabled: true, supportsHover: true },
  { enabled: false, supportsHover: false },
  { enabled: true, supportsHover: false },
])('<TabEditActionsWrapper />: flag $enabled, hover $supportsHover', ({ enabled, supportsHover }) => {
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

  test(`when hovering a tab in edit mode, its popover is ${enabled ? 'shown' : 'hidden'}`, async () => {
    const { elements, actions } = renderTabEditActions();

    await actions.hoverAndRest();

    if (enabled) {
      expect(elements.popover()).toBeInTheDocument();
    } else {
      expect(elements.popover()).not.toBeInTheDocument();
    }
  });
});

describe('<TabEditActionsWrapper /> settings', () => {
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

  test('when the user clicks Tab settings on a tab inside a repeated row, settings open for the source tab', async () => {
    const sourceTab = new TabItem({ key: 'tab-1', title: 'Overview' });
    const clonedTab = new TabItem({ key: 'tab-1-clone', title: 'Overview' });
    const sourceRow = new RowItem({ key: 'row-1', layout: new TabsLayoutManager({ tabs: [sourceTab] }) });
    const clonedRow = new RowItem({
      key: 'row-1-clone',
      repeatSourceKey: 'row-1',
      layout: new TabsLayoutManager({ tabs: [clonedTab] }),
    });
    sourceRow.setState({ repeatedRows: [clonedRow] });
    const scene = new DashboardScene({ isEditing: true, body: new RowsLayoutManager({ rows: [sourceRow] }) });
    const { actions } = renderTabEditActions(clonedTab);

    await actions.hoverAndRest();
    actions.clickSettings();

    expect(scene.state.sidebar.getSelectedObject()?.state.key).toBe('tab-1');
  });
});
