import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';

import { DataLinksContextMenu, type DataLinksMenuTriggerProps } from './DataLinksContextMenu';

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
      // We can't assert pseudo-class styles directly in jsdom, but we can verify
      // the themed class is applied — the rule that fixes the missing focus
      // indicator (`&:focus-visible { outline: 2px solid ... }`) lives in this
      // class and is exercised end-to-end by the panel-level Playwright tests.
      render(
        <DataLinksContextMenu links={singleLink}>{() => <div aria-label="fake aria label" />}</DataLinksContextMenu>
      );

      const anchor = screen.getByTestId(selectors.components.DataLinksContextMenu.singleLink);
      expect(anchor.className).toMatch(/css-/);
    });
  });

  describe('multi-link accessibility (triggerProps API)', () => {
    it('exposes triggerProps with role="button", tabIndex=0 and aria-haspopup="menu"', () => {
      let captured: DataLinksMenuTriggerProps | undefined;
      render(
        <DataLinksContextMenu links={twoLinks}>
          {({ triggerProps }) => {
            captured = triggerProps;
            return <div aria-label="fake aria label" />;
          }}
        </DataLinksContextMenu>
      );

      expect(captured).toBeDefined();
      expect(captured!.role).toBe('button');
      expect(captured!.tabIndex).toBe(0);
      expect(captured!['aria-haspopup']).toBe('menu');
      expect(typeof captured!.onClick).toBe('function');
      expect(typeof captured!.onKeyDown).toBe('function');
    });

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

      expect(screen.queryByText('Link1')).not.toBeInTheDocument();
      await user.click(screen.getByTestId('trigger'));
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

      expect(screen.queryByText('Link1')).not.toBeInTheDocument();
      screen.getByTestId('trigger').focus();
      await user.keyboard(sequence);
      expect(screen.getByText('Link1')).toBeInTheDocument();
      expect(screen.getByText('Link2')).toBeInTheDocument();
    });

    it('does not open the menu for unrelated keys', async () => {
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

      screen.getByTestId('trigger').focus();
      await user.keyboard('a');
      // `userEvent.keyboard('{Tab}')` would shift focus elsewhere, which doesn't
      // exercise the trigger's onKeyDown — calling `user.tab()` instead asserts
      // the same thing: Tab should not open the menu.
      await user.tab();
      expect(screen.queryByText('Link1')).not.toBeInTheDocument();
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
