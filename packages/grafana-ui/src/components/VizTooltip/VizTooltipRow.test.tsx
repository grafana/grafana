import { render, screen } from '@testing-library/react';

import { VizTooltipRow } from './VizTooltipRow';
import { ColorIndicator, ColorPlacement } from './types';

const defaultProps = {
  label: 'My Label',
  value: 'My Value',
  isPinned: false,
};

describe('VizTooltipRow', () => {
  describe('basic rendering', () => {
    it('renders label text', () => {
      render(<VizTooltipRow {...defaultProps} />);
      expect(screen.getByText('My Label')).toBeInTheDocument();
    });

    it('renders value text', () => {
      render(<VizTooltipRow {...defaultProps} />);
      expect(screen.getByText('My Value')).toBeInTheDocument();
    });

    it('does not render label when label is empty', () => {
      const { container } = render(<VizTooltipRow {...defaultProps} label="" />);
      // labelWrapper div not rendered when label is falsy
      expect(container.querySelector('[class*="labelWrapper"]')).not.toBeInTheDocument();
    });

    it('renders a ReactNode value', () => {
      render(<VizTooltipRow {...defaultProps} value={<span data-testid="node-value">custom</span>} />);
      expect(screen.getByTestId('node-value')).toBeInTheDocument();
    });
  });

  describe('color indicator placement', () => {
    it('renders a color indicator at first position (default)', () => {
      render(
        <VizTooltipRow
          {...defaultProps}
          color="#ff0000"
          colorIndicator={ColorIndicator.series}
          colorPlacement={ColorPlacement.first}
        />
      );
      expect(screen.getByTestId('series-icon')).toBeInTheDocument();
    });

    it('renders a color indicator at leading position inside value wrapper', () => {
      render(
        <VizTooltipRow
          {...defaultProps}
          color="#ff0000"
          colorIndicator={ColorIndicator.series}
          colorPlacement={ColorPlacement.leading}
        />
      );
      expect(screen.getByTestId('series-icon')).toBeInTheDocument();
    });

    it('renders a color indicator at trailing position', () => {
      render(
        <VizTooltipRow
          {...defaultProps}
          color="#ff0000"
          colorIndicator={ColorIndicator.series}
          colorPlacement={ColorPlacement.trailing}
        />
      );
      expect(screen.getByTestId('series-icon')).toBeInTheDocument();
    });

    it('does not render a color indicator when color is not provided', () => {
      render(<VizTooltipRow {...defaultProps} colorPlacement={ColorPlacement.first} />);
      expect(screen.queryByTestId('series-icon')).not.toBeInTheDocument();
    });

    it('does not render a color indicator when colorPlacement is hidden', () => {
      render(
        <VizTooltipRow
          {...defaultProps}
          color="#ff0000"
          colorIndicator={ColorIndicator.series}
          colorPlacement={ColorPlacement.hidden}
        />
      );
      expect(screen.queryByTestId('series-icon')).not.toBeInTheDocument();
    });
  });

  describe('pinned vs unpinned', () => {
    it('renders label as plain text when not pinned', () => {
      render(<VizTooltipRow {...defaultProps} isPinned={false} />);
      expect(screen.getByText('My Label')).toBeInTheDocument();
    });

    it('renders label text when pinned', () => {
      render(<VizTooltipRow {...defaultProps} isPinned={true} />);
      expect(screen.getByText('My Label')).toBeInTheDocument();
    });

    it('renders value text when pinned', () => {
      render(<VizTooltipRow {...defaultProps} isPinned={true} />);
      expect(screen.getByText('My Value')).toBeInTheDocument();
    });
  });

  describe('isHiddenFromViz', () => {
    it('renders a hollow color indicator when isHiddenFromViz is true', () => {
      const { container } = render(
        <VizTooltipRow
          {...defaultProps}
          color="#ff0000"
          colorIndicator={ColorIndicator.series}
          colorPlacement={ColorPlacement.first}
          isHiddenFromViz
        />
      );
      // Hollow series indicator renders a div with border, not SeriesIcon
      expect(screen.queryByTestId('series-icon')).not.toBeInTheDocument();
      const div = container.querySelector('[style*="border"]');
      expect(div).toBeInTheDocument();
    });
  });
});
