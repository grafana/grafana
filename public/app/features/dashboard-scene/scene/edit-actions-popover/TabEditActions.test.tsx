import { cleanup } from '@testing-library/react';
import { act, render, userEvent } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { ElementSelectionContext } from '@grafana/ui';

import { TabItem } from '../layout-tabs/TabItem';

import { WAIT_FOR_MOUSE_REST_DURATION_MS } from './EditActionsPopover';
import { TabEditActionsWrapper } from './TabEditActions';

function renderTabEditActions() {
  const tab = new TabItem({ title: 'Overview' });
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
