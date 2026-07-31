import { render, screen } from 'test/test-utils';

import { createTheme, type NavModelItem } from '@grafana/data';

import { MegaMenuPinnedItem } from './MegaMenuPinnedItem';
import { type PinnedLine } from './utils';

const renderItem = (
  activeItem?: NavModelItem,
  item: NavModelItem = { text: 'Explore', url: '/explore', id: 'explore' }
) => {
  const line: PinnedLine = { item, ancestors: [], icon: 'compass' };
  return render(
    <ul>
      <MegaMenuPinnedItem line={line} activeItem={activeItem} onUnpin={() => {}} />
    </ul>
  );
};

describe('MegaMenuPinnedItem', () => {
  it('does not claim aria-current when the active item is a different copy of the same route', () => {
    // aria-current is reference-based: a same-url but different-reference activeItem (e.g. the item
    // resolved to a nav ancestor copy) must not put a second aria-current="page" on the route.
    renderItem({ text: 'Explore', url: '/explore', id: 'explore' });

    expect(screen.getByRole('link', { name: /Explore/ })).not.toHaveAttribute('aria-current');
  });

  it('claims aria-current when it is the canonical active item', () => {
    // getActiveItem now resolves the pinned copy first, so when the current page is pinned this row is
    // the canonical active item and owns aria-current (the nav copy, resolved by reference, does not).
    const item: NavModelItem = { text: 'Explore', url: '/explore', id: 'explore' };
    renderItem(item, item);

    expect(screen.getByRole('link', { name: /Explore/ })).toHaveAttribute('aria-current', 'page');
  });

  it('highlights the row with the selected treatment whenever the current route matches', () => {
    // The visual highlight is url-based, so the row reads as selected even when aria-current lands on a
    // different copy — the pinned row shows the same active background the nav row uses.
    renderItem({ text: 'Explore', url: '/explore', id: 'explore' });

    const row = screen.getByRole('link', { name: /Explore/ }).closest('li')?.firstElementChild;
    expect(row).toHaveStyle({ backgroundColor: createTheme().colors.action.selected });
  });
});
