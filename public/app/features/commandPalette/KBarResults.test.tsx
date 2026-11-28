import { ActionImpl, useKBar } from 'kbar';
import * as React from 'react';
import { fireEvent, render, screen } from 'test/test-utils';

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

function setupKBarMock(activeIndex = 0, { searchQuery = '', currentRootActionId = null as string | null } = {}) {
  (useKBar as jest.Mock).mockImplementation((collector?: (state: unknown) => unknown) => {
    const state = { searchQuery, currentRootActionId, activeIndex };
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

    it('sets aria-posinset and aria-setsize scoped to each group', () => {
      render(
        <KBarResults
          items={[
            'Dashboards',
            createAction({ id: 'home', name: 'Home' }),
            createAction({ id: 'explore', name: 'Explore' }),
            'Folders',
            createAction({ id: 'folder-1', name: 'My Folder' }),
          ]}
          onRender={renderItem}
        />
      );

      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveAttribute('aria-posinset', '1');
      expect(options[0]).toHaveAttribute('aria-setsize', '2');
      expect(options[1]).toHaveAttribute('aria-posinset', '2');
      expect(options[1]).toHaveAttribute('aria-setsize', '2');
      expect(options[2]).toHaveAttribute('aria-posinset', '1');
      expect(options[2]).toHaveAttribute('aria-setsize', '1');
    });

    it('counts ungrouped leading items as their own set', () => {
      render(
        <KBarResults
          items={[
            createAction({ id: 'home', name: 'Home' }),
            createAction({ id: 'explore', name: 'Explore' }),
            'Folders',
            createAction({ id: 'folder-1', name: 'My Folder' }),
          ]}
          onRender={renderItem}
        />
      );

      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveAttribute('aria-posinset', '1');
      expect(options[0]).toHaveAttribute('aria-setsize', '2');
      expect(options[1]).toHaveAttribute('aria-posinset', '2');
      expect(options[1]).toHaveAttribute('aria-setsize', '2');
      expect(options[2]).toHaveAttribute('aria-posinset', '1');
      expect(options[2]).toHaveAttribute('aria-setsize', '1');
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

  describe('active item', () => {
    const [home, explore, settings] = ['home', 'explore', 'settings'].map((id) => createAction({ id, name: id }));
    const late = createAction({ id: 'late', name: 'late' });

    it('starts on the first action, skipping a leading group header', () => {
      render(<KBarResults items={['Group', home]} onRender={renderItem} />);

      expect(mockQuery.setActiveIndex).toHaveBeenLastCalledWith(1);
    });

    it('keeps the action the user picked highlighted when results are added above it', () => {
      setupKBarMock(1);
      const { rerender } = render(<KBarResults items={[home, explore, settings]} onRender={renderItem} />);
      fireEvent.keyDown(window, { key: 'ArrowDown' });

      rerender(<KBarResults items={['Late', late, home, explore, settings]} onRender={renderItem} />);

      expect(mockQuery.setActiveIndex).toHaveBeenLastCalledWith(3);
    });

    it('keeps the action the user picked highlighted when results are added below it', () => {
      setupKBarMock(1);
      const { rerender } = render(<KBarResults items={[home, explore, settings]} onRender={renderItem} />);
      fireEvent.keyDown(window, { key: 'ArrowDown' });

      mockQuery.setActiveIndex.mockClear();
      rerender(<KBarResults items={[home, explore, settings, 'Late', late]} onRender={renderItem} />);

      expect(mockQuery.setActiveIndex).not.toHaveBeenCalled();
    });

    it('does not reset when only the active index changes', () => {
      setupKBarMock(1);
      const items = [home, explore, settings];
      const { rerender } = render(<KBarResults items={items} onRender={renderItem} />);

      mockQuery.setActiveIndex.mockClear();
      setupKBarMock(2);
      rerender(<KBarResults items={items} onRender={renderItem} />);

      expect(mockQuery.setActiveIndex).not.toHaveBeenCalled();
    });

    it('keeps the first of two rows for the same action as active when the user moved to the second', () => {
      setupKBarMock(0);
      const items = [home, explore, home];
      const { rerender } = render(<KBarResults items={items} onRender={renderItem} />);
      fireEvent.keyDown(window, { key: 'ArrowDown' });

      mockQuery.setActiveIndex.mockClear();
      setupKBarMock(2);
      rerender(<KBarResults items={[...items, late]} onRender={renderItem} />);

      expect(mockQuery.setActiveIndex).not.toHaveBeenCalled();
    });

    it('resets to the start when the action the user picked is no longer in the results', () => {
      setupKBarMock(1);
      const { rerender } = render(<KBarResults items={[home, explore, settings]} onRender={renderItem} />);
      fireEvent.keyDown(window, { key: 'ArrowDown' });

      rerender(<KBarResults items={['Late', late, home, settings]} onRender={renderItem} />);

      expect(mockQuery.setActiveIndex).toHaveBeenLastCalledWith(1);
    });

    it('resets to the start when the search changes', () => {
      setupKBarMock(1, { searchQuery: 'ho' });
      const { rerender } = render(<KBarResults items={[home, explore, settings]} onRender={renderItem} />);

      setupKBarMock(1, { searchQuery: 'hom' });
      rerender(<KBarResults items={[settings, explore, home]} onRender={renderItem} />);

      expect(mockQuery.setActiveIndex).toHaveBeenLastCalledWith(0);
    });

    it('resets to the start when the root action changes', () => {
      setupKBarMock(1);
      const { rerender } = render(<KBarResults items={[home, explore, settings]} onRender={renderItem} />);

      setupKBarMock(1, { currentRootActionId: 'parent' });
      rerender(<KBarResults items={[settings, explore, home]} onRender={renderItem} />);

      expect(mockQuery.setActiveIndex).toHaveBeenLastCalledWith(0);
    });
  });

  describe('active item while results arrive after a search', () => {
    // Applies setActiveIndex like kbar's store does, so the effects of one change feed the next render.
    function WithKBarState({ items, search }: { items: Array<ActionImpl | string>; search: string }) {
      const [activeIndex, setActiveIndex] = React.useState(0);
      mockQuery.setActiveIndex.mockImplementation(setActiveIndex);
      setupKBarMock(activeIndex, { searchQuery: search });
      return <KBarResults items={items} onRender={renderItem} />;
    }

    const activeRow = () => screen.getByRole('option', { selected: true });
    const action = (id: string) => createAction({ id, name: id });

    it('starts on the first action when several headers precede it', () => {
      render(<WithKBarState items={['Loading', 'Dashboards', action('dash-1')]} search="a" />);

      expect(activeRow()).toHaveAccessibleName('Dashboards: dash-1');
    });

    it('skips a run of headers with the arrow keys in both directions', () => {
      const items = [action('a'), 'Loading', 'Dashboards', action('b')];
      render(<WithKBarState items={items} search="a" />);

      fireEvent.keyDown(window, { key: 'ArrowDown' });
      expect(activeRow()).toHaveAccessibleName('Dashboards: b');

      fireEvent.keyDown(window, { key: 'ArrowUp' });
      expect(activeRow()).toHaveAccessibleName('a');
    });

    it('stays on the last action when only headers follow it', () => {
      render(<WithKBarState items={[action('a'), 'Loading']} search="a" />);

      fireEvent.keyDown(window, { key: 'ArrowDown' });

      expect(activeRow()).toHaveAccessibleName('a');
    });

    it('does not carry the highlight to a plugin result that is pushed down by dashboard results arriving later', () => {
      const [dash1, dash2, plugin1] = [action('dash-1'), action('dash-2'), action('plugin-1')];
      // Typing, the plugin's answer to the previous query is all that is on screen, so its result is the top row.
      const { rerender } = render(<WithKBarState items={['Plugin results', plugin1]} search="cortex-gatewa" />);
      rerender(<WithKBarState items={['Plugin results', plugin1]} search="cortex-gateway" />);
      expect(activeRow()).toHaveAccessibleName('Plugin results: plugin-1');

      // The dashboard search for the final query answers and lands above the plugin section.
      rerender(
        <WithKBarState items={['Dashboards', dash1, dash2, 'Plugin results', plugin1]} search="cortex-gateway" />
      );

      expect(activeRow()).toHaveAccessibleName('Dashboards: dash-1');
    });

    it('keeps the row the user moved to when a plugin section arrives, even if rows above it are added', () => {
      const [dash1, dash2, plugin1] = [action('dash-1'), action('dash-2'), action('plugin-1')];
      const { rerender } = render(<WithKBarState items={['Dashboards', dash1, dash2]} search="cortex" />);
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      expect(activeRow()).toHaveAccessibleName('Dashboards: dash-2');

      rerender(<WithKBarState items={['Dashboards', dash1, dash2, 'Plugin results', plugin1]} search="cortex" />);

      expect(activeRow()).toHaveAccessibleName('Dashboards: dash-2');
    });

    it('does not throw when the results shrink below the row the user moved to', () => {
      const [dash1, dash2, dash3] = [action('dash-1'), action('dash-2'), action('dash-3')];
      const { rerender } = render(<WithKBarState items={['Dashboards', dash1, dash2, dash3]} search="cortex" />);
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      fireEvent.keyDown(window, { key: 'ArrowDown' });

      rerender(<WithKBarState items={['Dashboards', dash1]} search="cortex" />);

      expect(activeRow()).toHaveAccessibleName('Dashboards: dash-1');
    });

    it('keeps the first row highlighted when a plugin section is appended after dashboard results arrived', () => {
      const [home, explore] = [action('home'), action('explore')];
      const [folder, dash1, dash2] = [action('folder-1'), action('dash-1'), action('dash-2')];
      const [plugin1, plugin2] = [action('plugin-1'), action('plugin-2')];
      const { rerender } = render(<WithKBarState items={[home, explore]} search="" />);

      // The user types; nothing matches yet, so only the previous search's rows remain.
      rerender(<WithKBarState items={[home, explore]} search="cortex-gateway" />);
      rerender(<WithKBarState items={[]} search="cortex-gateway" />);
      // The dashboard search answers.
      rerender(<WithKBarState items={['Folders', folder, 'Dashboards', dash1, dash2]} search="cortex-gateway" />);
      expect(activeRow()).toHaveAccessibleName('Folders: folder-1');

      // A plugin answers a second or two later.
      rerender(
        <WithKBarState
          items={['Folders', folder, 'Dashboards', dash1, dash2, 'Plugin results', plugin1, plugin2]}
          search="cortex-gateway"
        />
      );

      expect(activeRow()).toHaveAccessibleName('Folders: folder-1');
    });
  });
});
