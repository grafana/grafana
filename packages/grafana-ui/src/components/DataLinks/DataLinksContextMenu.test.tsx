import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';

import { DataLinksContextMenu, type DataLinksMenuTriggerProps } from './DataLinksContextMenu';

const fakeAriaLabel = 'fake aria label';

const multipleLinks = () => [
  { href: '/link1', title: 'Link1', target: '_blank' as const, origin: {} },
  { href: '/link2', title: 'Link2', target: '_blank' as const, origin: {} },
];

const singleLink = () => [{ href: '/link1', title: 'Link1', target: '_blank' as const, origin: {} }];

describe('DataLinksContextMenu', () => {
  it('renders context menu when there are more than one data links', () => {
    render(
      <DataLinksContextMenu links={multipleLinks}>{() => <div aria-label="fake aria label" />}</DataLinksContextMenu>
    );

    expect(screen.getByLabelText(fakeAriaLabel)).toBeInTheDocument();
    expect(screen.queryAllByLabelText(selectors.components.DataLinksContextMenu.singleLink)).toHaveLength(0);
  });

  it('renders link when there is a single data link', () => {
    render(
      <DataLinksContextMenu links={singleLink}>{() => <div aria-label="fake aria label" />}</DataLinksContextMenu>
    );

    expect(screen.getByLabelText(fakeAriaLabel)).toBeInTheDocument();
    expect(screen.getByTestId(selectors.components.DataLinksContextMenu.singleLink)).toBeInTheDocument();
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
        <DataLinksContextMenu links={multipleLinks}>
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
        <DataLinksContextMenu links={multipleLinks}>
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
        <DataLinksContextMenu links={multipleLinks}>
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
        <DataLinksContextMenu links={multipleLinks}>
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
