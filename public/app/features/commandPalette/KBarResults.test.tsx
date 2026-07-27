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
      ...(collector ? (collector(state) as object) : {}),
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

  describe('action items', () => {
    it('renders with role="option"', () => {
      render(<KBarResults items={[createAction({ name: 'Explore' })]} onRender={renderItem} />);

      expect(screen.getByRole('option')).toBeInTheDocument();
    });

    it('includes the group name in the accessible name when preceded by a group header', () => {
      render(<KBarResults items={['Dashboards', createAction({ id: 'home', name: 'Home' })]} onRender={renderItem} />);

      expect(screen.getByRole('option')).toHaveAccessibleName('Dashboards: Home');
    });

    it('does not add a group prefix when there is no preceding group header', () => {
      render(<KBarResults items={[createAction({ id: 'home', name: 'Home' })]} onRender={renderItem} />);

      expect(screen.getByRole('option')).toHaveAccessibleName('Home');
    });

    it('uses the most recent group label when there are multiple groups', () => {
      render(
        <KBarResults
          items={[
            'Dashboards',
            createAction({ id: 'home', name: 'Home' }),
            'Folders',
            createAction({ id: 'folder-1', name: 'My Folder' }),
          ]}
          onRender={renderItem}
        />
      );

      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveAccessibleName('Dashboards: Home');
      expect(options[1]).toHaveAccessibleName('Folders: My Folder');
    });

    it('marks the active item with aria-selected="true" and others with aria-selected="false"', () => {
      setupKBarMock(1);
      render(
        <KBarResults
          items={[createAction({ id: 'home', name: 'Home' }), createAction({ id: 'explore', name: 'Explore' })]}
          onRender={renderItem}
        />
      );

      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveAttribute('aria-selected', 'false');
      expect(options[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('renders as an anchor tag when the item has a URL', () => {
      render(<KBarResults items={[createAction({ name: 'Home', url: '/dashboard/home' })]} onRender={renderItem} />);

      // The <a> has role="option" which overrides the implicit link role
      expect(screen.getByRole('option')).toHaveAttribute('href', '/dashboard/home');
    });

    it('passes target attribute through to anchor tags', () => {
      render(
        <KBarResults
          items={[createAction({ name: 'External', url: 'https://example.com', target: '_blank' })]}
          onRender={renderItem}
        />
      );

      expect(screen.getByRole('option')).toHaveAttribute('target', '_blank');
    });
  });

  it('calls onRender for every item', () => {
    const items = ['Group', createAction({ name: 'Home' })];
    render(<KBarResults items={items} onRender={renderItem} />);

    expect(renderItem).toHaveBeenCalledTimes(2);
  });
});
