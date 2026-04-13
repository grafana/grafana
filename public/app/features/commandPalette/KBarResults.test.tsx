import { ActionImpl, useKBar } from 'kbar';
import { render, screen } from 'test/test-utils';

import { KBarResults } from './KBarResults';

jest.mock('kbar', () => {
  const { ActionImpl } = jest.requireActual('kbar/lib/action');
  return {
    ActionImpl,
    KBAR_LISTBOX: 'kbar-listbox',
    getListboxItemId: (id: number) => `kbar-listbox-item-${id}`,
    useKBar: jest.fn(),
  };
});

jest.mock('kbar/lib/utils', () => ({
  ...jest.requireActual('kbar/lib/utils'),
  usePointerMovedSinceMount: jest.fn().mockReturnValue(false),
}));

// Render all items synchronously without actual DOM measurement
jest.mock('react-virtual', () => ({
  useVirtual: ({ size }: { size: number }) => ({
    virtualItems: Array.from({ length: size }, (_, index) => ({
      index,
      start: index * 50,
      measureRef: jest.fn(),
    })),
    totalSize: size * 50,
    scrollToIndex: jest.fn(),
  }),
}));

const mockQuery = {
  setActiveIndex: jest.fn(),
  toggle: jest.fn(),
  setSearch: jest.fn(),
  setCurrentRootAction: jest.fn(),
};

function setupKBarMock(activeIndex = 0) {
  (useKBar as jest.Mock).mockImplementation((collector?: (state: unknown) => unknown) => {
    const state = { searchQuery: '', currentRootActionId: null, activeIndex };
    return {
      ...(collector ? collector(state) : {}),
      query: mockQuery,
      options: {},
    };
  });
}

function createAction(props: Record<string, unknown> = {}): ActionImpl {
  return ActionImpl.create({ id: 'test-action', name: 'Test Action', ...props }, { store: {} });
}

describe('KBarResults', () => {
  const renderItem = jest.fn(({ item }: { item: ActionImpl | string }) => (
    <div>{typeof item === 'string' ? item : item.name}</div>
  ));

  beforeEach(() => {
    jest.clearAllMocks();
    setupKBarMock();
  });

  describe('group headers', () => {
    it('renders with aria-hidden', () => {
      render(<KBarResults items={['Dashboards', createAction({ name: 'Home' })]} onRender={renderItem} />);

      const groupContainer = screen.getByText('Dashboards').closest('[aria-hidden]');
      expect(groupContainer).toHaveAttribute('aria-hidden', 'true');
    });

    it('does not have role="option"', () => {
      render(<KBarResults items={['Dashboards']} onRender={renderItem} />);

      expect(screen.queryByRole('option')).not.toBeInTheDocument();
    });
  });
});
