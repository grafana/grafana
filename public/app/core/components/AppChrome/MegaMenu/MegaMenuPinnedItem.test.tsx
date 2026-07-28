import { render, screen } from 'test/test-utils';

import { type NavModelItem } from '@grafana/data';

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
  it('does not claim aria-current when the active item is a different (nav) copy of the same route', () => {
    // getActiveItem resolves the nav copy first, so a pinned item that's also in the nav receives an
    // activeItem with the same url but a different reference. The nav row owns aria-current; marking
    // it here too would put aria-current="page" on two links for the same route.
    renderItem({ text: 'Explore', url: '/explore', id: 'explore' });

    expect(screen.getByRole('link', { name: /Explore/ })).not.toHaveAttribute('aria-current');
  });

  it('claims aria-current when it is the canonical active item', () => {
    // When the pinned copy itself is what getActiveItem returned (e.g. the item is hidden from the
    // nav but still pinned), this is the only row for the route, so it owns aria-current.
    const item: NavModelItem = { text: 'Explore', url: '/explore', id: 'explore' };
    renderItem(item, item);

    expect(screen.getByRole('link', { name: /Explore/ })).toHaveAttribute('aria-current', 'page');
  });
});
