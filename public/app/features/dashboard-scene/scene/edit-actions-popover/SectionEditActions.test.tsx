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
import { SectionEditActionsWrapper } from './SectionEditActions';

type Kind = 'row' | 'tab';

function renderSectionEditActions(
  kind: Kind,
  item = kind === 'row' ? new RowItem({ title: 'Overview' }) : new TabItem({ title: 'Overview' })
) {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  const result = render(
    <ElementSelectionContext.Provider value={{ enabled: true, selected: [], onSelect: jest.fn(), onClear: jest.fn() }}>
      <SectionEditActionsWrapper kind={kind} item={item}>
        <button>Overview</button>
      </SectionEditActionsWrapper>
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
        fireEvent.click(result.getByRole('button', { name: kind === 'row' ? 'Row settings' : 'Tab settings' }));
      },
    },
  };
}

describe.each(
  (['row', 'tab'] as const).flatMap((kind) => [
    { kind, enabled: false, supportsHover: true },
    { kind, enabled: true, supportsHover: true },
    { kind, enabled: false, supportsHover: false },
    { kind, enabled: true, supportsHover: false },
  ])
)('<SectionEditActionsWrapper /> $kind: flag $enabled, hover $supportsHover', ({ kind, enabled, supportsHover }) => {
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

  test(`when hovering a ${kind} in edit mode, its popover is ${enabled ? 'shown' : 'hidden'}`, async () => {
    const { elements, actions } = renderSectionEditActions(kind);

    await actions.hoverAndRest();

    if (enabled) {
      expect(elements.popover()).toBeInTheDocument();
    } else {
      expect(elements.popover()).not.toBeInTheDocument();
    }
  });
});

describe('<SectionEditActionsWrapper /> settings', () => {
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
    const { actions } = renderSectionEditActions('row', clonedRow);

    await actions.hoverAndRest();
    actions.clickSettings();

    expect(scene.state.sidebar.getSelectedObject()?.state.key).toBe('row-1');
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
    const { actions } = renderSectionEditActions('tab', clonedTab);

    await actions.hoverAndRest();
    actions.clickSettings();

    expect(scene.state.sidebar.getSelectedObject()?.state.key).toBe('tab-1');
  });
});
