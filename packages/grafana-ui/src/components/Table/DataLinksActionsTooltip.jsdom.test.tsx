/** @jest-environment jsdom */

// Happy DOM resolves 100vh to pixels in computed styles, so keep this calc() assertion in jsdom.
import { render, screen } from '@testing-library/react';

import { type LinkModel } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { DataLinksActionsTooltip } from './DataLinksActionsTooltip';

describe('DataLinksActionsTooltip', () => {
  const mockCoords = { clientX: 100, clientY: 100 };
  const mockLink: LinkModel = {
    href: 'http://link1.com',
    title: 'Data Link1',
    target: '_blank',
    onClick: jest.fn(),
    origin: { ref: { uid: 'test' } },
  };

  it('should apply viewport-constrained scroll styles to the tooltip wrapper', () => {
    const manyLinks = Array.from({ length: 20 }, (_, index) => ({
      ...mockLink,
      title: `Data Link ${index + 1}`,
      href: `http://link${index + 1}.com`,
    }));

    render(<DataLinksActionsTooltip links={manyLinks} coords={mockCoords} />);

    const tooltipWrapper = screen.getByTestId(selectors.components.DataLinksActionsTooltip.tooltipWrapper);
    expect(tooltipWrapper).toHaveStyle({
      maxHeight: 'calc(100vh - 32px)',
      overflowX: 'hidden',
    });
  });
});
