import { ActionImpl, KBarProvider, type KBarQuery, useKBar } from 'kbar';
import { useEffect } from 'react';
import { act, render, screen } from 'test/test-utils';

import { KBarResults } from './KBarResults';

// jsdom has no layout, so the real virtualizer would only render an arbitrary window of rows.
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

type Item = ActionImpl | string;

const action = (id: string) => ActionImpl.create({ id, name: id }, { store: {} });

const renderItem = ({ item }: { item: Item }) => <div>{typeof item === 'string' ? item : item.name}</div>;

// Hands the store's query to the tests so they can drive the index and search like the palette's input does.
let query: KBarQuery;
function CaptureQuery() {
  const kbar = useKBar();
  useEffect(() => {
    query = kbar.query;
  });
  return null;
}

// The store owns the active index and outlives KBarResults, so `null` leaves KBarResults unmounted
// while the provider keeps its state.
function setup(items: Item[] | null) {
  const tree = (items: Item[] | null) => (
    <KBarProvider>
      <CaptureQuery />
      {items && <KBarResults items={items} onRender={renderItem} />}
    </KBarProvider>
  );
  const { rerender, user } = render(tree(items));
  return { user, rerender: (items: Item[] | null) => rerender(tree(items)) };
}

const activeRow = () => screen.getByRole('option', { selected: true });

describe('KBarResults active index', () => {
  it('starts on the first action, skipping a leading group header', () => {
    setup(['Dashboards', action('home'), action('explore')]);

    expect(activeRow()).toHaveTextContent('home');
  });

  it('resets to the top when the search changes', () => {
    setup([action('home'), action('explore'), action('alerts')]);
    act(() => query.setActiveIndex(2));

    act(() => query.setSearch('a'));

    expect(activeRow()).toHaveTextContent('home');
  });

  it('keeps the navigated row when more results arrive for the same query', () => {
    const items = [action('home'), action('explore'), action('alerts')];
    const { rerender } = setup(items);
    act(() => query.setActiveIndex(2));

    rerender([...items, 'Dashboards', action('dash-1'), action('dash-2')]);

    expect(activeRow()).toHaveTextContent('alerts');
  });

  it('clamps to the last action when results shrink past the active row', () => {
    const { rerender } = setup([action('home'), action('explore'), action('alerts'), action('users')]);
    act(() => query.setActiveIndex(3));

    rerender([action('home'), action('explore'), 'Dashboards']);

    expect(activeRow()).toHaveTextContent('explore');
  });

  it('moves to the next action when a group header lands on the active row', () => {
    const { rerender } = setup([action('home'), action('explore'), action('alerts')]);
    act(() => query.setActiveIndex(1));

    rerender([action('home'), 'Dashboards', action('explore'), action('alerts')]);

    expect(activeRow()).toHaveTextContent('explore');
  });

  it('starts at the top when remounted while the store still holds an index past the end', () => {
    const { rerender } = setup(null);
    act(() => query.setActiveIndex(7));

    rerender([action('home'), action('explore'), action('alerts')]);

    expect(activeRow()).toHaveTextContent('home');
  });

  it('arrow keys skip consecutive group headers and stop at the ends', async () => {
    const { user } = setup([action('home'), 'Dashboards', 'Folders', action('explore')]);

    await user.keyboard('{ArrowDown}');
    expect(activeRow()).toHaveTextContent('explore');

    await user.keyboard('{ArrowDown}');
    expect(activeRow()).toHaveTextContent('explore');

    await user.keyboard('{ArrowUp}');
    expect(activeRow()).toHaveTextContent('home');

    await user.keyboard('{ArrowUp}');
    expect(activeRow()).toHaveTextContent('home');
  });
});
