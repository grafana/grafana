import { render, screen } from '@testing-library/react';

import { VizTooltipContent } from './VizTooltipContent';
import { type VizTooltipItem } from './types';

const makeItem = (label: string, value = 'val'): VizTooltipItem => ({ label, value });

describe('VizTooltipContent', () => {
  describe('item rendering', () => {
    it('renders all item labels', () => {
      render(<VizTooltipContent items={[makeItem('Alpha'), makeItem('Beta'), makeItem('Gamma')]} isPinned={false} />);
      expect(screen.getByText('Alpha')).toBeInTheDocument();
      expect(screen.getByText('Beta')).toBeInTheDocument();
      expect(screen.getByText('Gamma')).toBeInTheDocument();
    });

    it('renders all item values', () => {
      render(<VizTooltipContent items={[makeItem('A', '10'), makeItem('B', '20')]} isPinned={false} />);
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('20')).toBeInTheDocument();
    });

    it('renders nothing when items array is empty', () => {
      const { container } = render(<VizTooltipContent items={[]} isPinned={false} />);
      // Only the wrapper div is present with no rows
      expect(container.firstChild?.childNodes.length).toBe(0);
    });
  });

  describe('scrollable behavior', () => {
    it('applies overflowY auto and maxHeight when scrollable is true', () => {
      const { container } = render(
        <VizTooltipContent items={[makeItem('A')]} isPinned={false} scrollable maxHeight={200} />
      );
      expect(container.firstChild).toHaveStyle({ overflowY: 'auto', maxHeight: '200px' });
    });

    it('does not apply overflow styles when scrollable is false', () => {
      const { container } = render(<VizTooltipContent items={[makeItem('A')]} isPinned={false} scrollable={false} />);
      expect(container.firstChild).not.toHaveStyle({ overflowY: 'auto' });
    });

    it('does not apply overflow styles by default', () => {
      const { container } = render(<VizTooltipContent items={[makeItem('A')]} isPinned={false} />);
      expect(container.firstChild).not.toHaveStyle({ overflowY: 'auto' });
    });
  });

  describe('children', () => {
    it('renders children after the items', () => {
      render(
        <VizTooltipContent items={[makeItem('A')]} isPinned={false}>
          <div data-testid="extra-child">footer content</div>
        </VizTooltipContent>
      );
      expect(screen.getByTestId('extra-child')).toBeInTheDocument();
    });

    it('renders children even when items is empty', () => {
      render(
        <VizTooltipContent items={[]} isPinned={false}>
          <span data-testid="child">child</span>
        </VizTooltipContent>
      );
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
  });
});
