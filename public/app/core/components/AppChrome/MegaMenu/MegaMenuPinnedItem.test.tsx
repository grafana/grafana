import { render, screen } from 'test/test-utils';

import { type NavModelItem } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';

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
  beforeEach(() => {
    contextSrv.isSignedIn = true;
  });

  afterEach(() => {
    contextSrv.isSignedIn = false;
  });
  it('does not claim aria-current when the active item is a different (nav) copy of the same route', () => {
    // getActiveItem resolves the nav copy first, so a pinned item that's also in the nav receives an
    // activeItem with the same url but a different reference. The nav row owns aria-current; marking
    // it here too would put aria-current="page" on two links for the same route.
    renderItem({ text: 'Explore', url: '/explore', id: 'explore' });

    expect(screen.getByRole('link', { name: /Explore/ })).not.toHaveAttribute('aria-current');
  });

  it('claims aria-current when it is the canonical active item', () => {
    // Only the canonical active copy owns aria-current.
    const item: NavModelItem = { text: 'Explore', url: '/explore', id: 'explore' };
    renderItem(item, item);

    expect(screen.getByRole('link', { name: /Explore/ })).toHaveAttribute('aria-current', 'page');
  });

  it('shortens deep breadcrumbs while exposing the full path in a tooltip', async () => {
    const { user } = render(
      <ul>
        <MegaMenuPinnedItem
          line={{
            item: { text: 'Users', url: '/admin/users' },
            ancestors: ['Administration', 'Users & access'],
            icon: 'cog',
          }}
          onUnpin={() => {}}
        />
      </ul>
    );
    const link = screen.getByRole('link', { name: '… Users & access Users' });
    expect(screen.getByTestId('icon-cog')).toBeInTheDocument();
    await user.hover(link);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Administration › Users & access › Users');
    expect(screen.getByLabelText('Unpin Users')).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps ampersands unescaped in the unpin tooltip content', async () => {
    const item: NavModelItem = { text: 'Explore & Test', url: '/explore', id: 'explore' };
    const { user } = renderItem(undefined, item);

    await user.hover(screen.getByRole('button', { name: 'Unpin Explore & Test' }));
    const tooltip = await screen.findByRole('tooltip');

    expect(tooltip).toHaveTextContent('Unpin Explore & Test');
    expect(tooltip).not.toHaveTextContent('Unpin Explore &amp; Test');
  });
});
