/** @jest-environment jsdom */

// Happy DOM does not apply :focus-visible styles to the focused anchor.
import { act, render, screen } from '@testing-library/react';

import { createTheme } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { DataLinksContextMenu } from './DataLinksContextMenu';

const singleLink = () => [{ href: '/link1', title: 'Link1', target: '_blank' as const, origin: {} }];

describe('DataLinksContextMenu', () => {
  describe('single-link accessibility', () => {
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
      expect(anchor).toHaveStyle({ outline: `2px solid ${createTheme().colors.primary.main}`, outlineOffset: '2px' });
    });
  });
});
