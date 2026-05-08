import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';

import { DataLinksContextMenu} from './DataLinksContextMenu';

const twoLinks = () => [
  { href: '/link1', title: 'Link1', target: '_blank' as const, origin: {} },
  { href: '/link2', title: 'Link2', target: '_blank' as const, origin: {} },
];

const singleLink = () => [{ href: '/link1', title: 'Link1', target: '_blank' as const, origin: {} }];

describe('DataLinksContextMenu', () => {
  it('passes openMenu and targetClassName to children for multiple links', () => {
    const childrenSpy = jest.fn(() => <div aria-label="child" />);
    render(<DataLinksContextMenu links={twoLinks}>{childrenSpy}</DataLinksContextMenu>);

    expect(childrenSpy).toHaveBeenCalledWith(
      expect.objectContaining({ openMenu: expect.any(Function), targetClassName: expect.any(String) })
    );
    expect(screen.queryByTestId(selectors.components.DataLinksContextMenu.singleLink)).not.toBeInTheDocument();
  });

  it('opens context menu and renders menu items on click', async () => {
    render(
      <DataLinksContextMenu links={twoLinks}>
        {({ openMenu }) => <button aria-label="trigger" onClick={openMenu} />}
      </DataLinksContextMenu>
    );

    await userEvent.click(screen.getByLabelText('trigger'));

    expect(screen.getByText('Data links')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Link1' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Link2' })).toBeInTheDocument();
  });

  it('renders single link with correct attributes and style', () => {
    render(
      <DataLinksContextMenu links={singleLink} style={{ color: 'red' }}>
        {() => <div aria-label="child" />}
      </DataLinksContextMenu>
    );

    const link = screen.getByTestId(selectors.components.DataLinksContextMenu.singleLink);
    expect(link).toHaveAttribute('href', '/link1');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('title', 'Link1');
    expect(link).toHaveStyle({ color: 'red', overflow: 'hidden', display: 'flex' });
  });

  it('calls onClick on single link when clicked', async () => {
    const onClick = jest.fn();
    const linkWithClick = () => [{ href: '/link1', title: 'Link1', target: '_blank' as const, origin: {}, onClick }];

    render(<DataLinksContextMenu links={linkWithClick}>{() => <span>click me</span>}</DataLinksContextMenu>);

    await userEvent.click(screen.getByText('click me'));

    expect(onClick).toHaveBeenCalled();
  });

  describe('single-link accessibility', () => {
    it('renders the single link as a real <a> with href so it is keyboard-focusable', () => {
      render(
        <DataLinksContextMenu links={singleLink}>{() => <div aria-label="fake aria label" />}</DataLinksContextMenu>
      );

      const anchor = screen.getByTestId(selectors.components.DataLinksContextMenu.singleLink);
      expect(anchor.tagName).toBe('A');
      expect(anchor).toHaveAttribute('href', '/link1');
    });

    it('exposes a focus-visible outline class on the single-link anchor', () => {
      // We can't assert pseudo-class styles directly in jsdom, but we can verify the themed class is applied
      render(
        <DataLinksContextMenu links={singleLink}>{() => <div aria-label="fake aria label" />}</DataLinksContextMenu>
      );
      const anchor = screen.getByTestId(selectors.components.DataLinksContextMenu.singleLink);
      expect(getComputedStyle(anchor).outline).toEqual('');
      act(() => {
        anchor.focus();
      });
      expect(anchor).toHaveFocus();
      expect(getComputedStyle(anchor).outline).toMatch(/2px solid .+/);
    });
  });

  describe('multi-link accessibility (triggerProps API)', () => {
    it('opens the context menu when triggerProps.onClick fires (mouse path)', async () => {
      const user = userEvent.setup();
      render(
        <DataLinksContextMenu links={twoLinks}>
          {({ triggerProps }) => (
            <button data-testid="trigger" {...triggerProps}>
              open
            </button>
          )}
        </DataLinksContextMenu>
      );

      expect(screen.queryByText('Link')).not.toBeInTheDocument();
      const linkMenu = screen.getByTestId('trigger');
      expect(linkMenu).toHaveRole('button');
      expect(linkMenu.tabIndex).toEqual(0);
      expect(linkMenu).toHaveAttribute('aria-haspopup', 'menu');

      await user.click(linkMenu);

      expect(screen.getByText('Link1')).toBeInTheDocument();
      expect(screen.getByText('Link2')).toBeInTheDocument();
    });

    it.each([
      { name: 'Enter', sequence: '{Enter}' },
      { name: 'Space', sequence: ' ' },
    ])('opens the context menu when $name is pressed', async ({ sequence }) => {
      // Regression test for the "synthetic MouseEvent('click', { clientX, clientY })"
      // anti-pattern that earlier iterations of this fix relied on — pressing Enter
      // or Space on the trigger should open the menu via the element-anchored path.
      const user = userEvent.setup();
      render(
        <DataLinksContextMenu links={twoLinks}>
          {({ triggerProps }) => (
            <button data-testid="trigger" {...triggerProps}>
              open
            </button>
          )}
        </DataLinksContextMenu>
      );

      expect(screen.queryByText('Link')).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();

      screen.getByTestId('trigger').focus();
      await user.keyboard(sequence);

      expect(screen.queryAllByRole('menuitem')).toHaveLength(2);
      expect(screen.getByText('Link1')).toBeInTheDocument();
      expect(screen.getByText('Link2')).toBeInTheDocument();
    });

    it('does not expose triggerProps for the single-link case (single link is a real <a>)', () => {
      let captured: unknown = 'unset';
      render(
        <DataLinksContextMenu links={singleLink}>
          {({ triggerProps }) => {
            captured = triggerProps;
            return <div aria-label="fake aria label" />;
          }}
        </DataLinksContextMenu>
      );

      expect(captured).toBeUndefined();
    });
  });
});
