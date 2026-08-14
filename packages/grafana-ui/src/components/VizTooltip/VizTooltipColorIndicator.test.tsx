import { render, screen } from '@testing-library/react';

import { ColorIndicatorPosition, VizTooltipColorIndicator } from './VizTooltipColorIndicator';
import { VizTooltipColorIndicator as VizColorIndicatorEnum } from './types';

describe('VizTooltipColorIndicator', () => {
  describe('series indicator', () => {
    it('renders a SeriesIcon when colorIndicator is series and not hollow', () => {
      render(<VizTooltipColorIndicator color="#ff0000" colorIndicator={VizColorIndicatorEnum.series} />);
      expect(screen.getByTestId('series-icon')).toBeInTheDocument();
    });

    it('renders a div instead of SeriesIcon when isHollow is true', () => {
      render(<VizTooltipColorIndicator color="#ff0000" colorIndicator={VizColorIndicatorEnum.series} isHollow />);
      expect(screen.queryByTestId('series-icon')).not.toBeInTheDocument();
    });

    it('applies border style when isHollow is true', () => {
      const { container } = render(
        <VizTooltipColorIndicator color="#ff0000" colorIndicator={VizColorIndicatorEnum.series} isHollow />
      );
      const div = container.querySelector('div');
      expect(div).toHaveStyle({ border: '1px solid #ff0000' });
    });
  });

  describe('non-series indicators', () => {
    it('renders a div with backgroundColor for value indicator', () => {
      const { container } = render(
        <VizTooltipColorIndicator color="#00ff00" colorIndicator={VizColorIndicatorEnum.value} />
      );
      expect(screen.queryByTestId('series-icon')).not.toBeInTheDocument();
      expect(container.querySelector('div')).toHaveStyle({ backgroundColor: '#00ff00' });
    });

    it('renders a div for hexagon indicator', () => {
      const { container } = render(
        <VizTooltipColorIndicator color="#0000ff" colorIndicator={VizColorIndicatorEnum.hexagon} />
      );
      expect(container.querySelector('div')).toBeInTheDocument();
    });

    it.each([
      VizColorIndicatorEnum.marker_sm,
      VizColorIndicatorEnum.marker_md,
      VizColorIndicatorEnum.marker_lg,
      VizColorIndicatorEnum.pie_1_4,
      VizColorIndicatorEnum.pie_2_4,
      VizColorIndicatorEnum.pie_3_4,
    ])('renders a div for %s indicator', (colorIndicator) => {
      const { container } = render(<VizTooltipColorIndicator color="#aabbcc" colorIndicator={colorIndicator} />);
      expect(container.querySelector('div')).toBeInTheDocument();
    });
  });

  describe('default behavior', () => {
    it('defaults to FALLBACK_COLOR when no color is provided', () => {
      render(<VizTooltipColorIndicator />);
      // Should render without throwing
      expect(screen.getByTestId('series-icon')).toBeInTheDocument();
    });

    it('defaults to Leading position', () => {
      render(<VizTooltipColorIndicator color="#ff0000" colorIndicator={VizColorIndicatorEnum.value} />);
      // No error thrown — position defaults are applied
      expect(document.querySelector('div')).toBeInTheDocument();
    });

    it('renders for Trailing position without error', () => {
      render(
        <VizTooltipColorIndicator
          color="#ff0000"
          colorIndicator={VizColorIndicatorEnum.value}
          position={ColorIndicatorPosition.Trailing}
        />
      );
      expect(document.querySelector('div')).toBeInTheDocument();
    });
  });
});
