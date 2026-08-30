import { render, screen } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';

import { XYCanvas } from './XYCanvas';

/**
 * XYCanvas is the shared overlay container used above uPlot’s plotting area (axes excluded).
 * These tests lock in positioning and content so features like EventsCanvas / exemplar markers stay aligned with the chart.
 */
describe('XYCanvas', () => {
  it('renders a single root with a stable test id for overlays', () => {
    render(<XYCanvas left={0} top={0}></XYCanvas>);

    expect(screen.getByTestId(selectors.components.UPlotChart.xyCanvas)).toBeInTheDocument();
  });

  it('positions the overlay with absolute left/top in CSS pixels', () => {
    render(
      <XYCanvas left={16} top={8}>
        <span>content</span>
      </XYCanvas>
    );

    expect(screen.getByTestId(selectors.components.UPlotChart.xyCanvas)).toHaveStyle({
      left: '16px',
      top: '8px',
    });
  });

  it('renders children inside the overlay', () => {
    render(
      <XYCanvas left={0} top={0}>
        <span data-testid="child-marker">marker</span>
      </XYCanvas>
    );

    expect(screen.getByTestId('child-marker')).toHaveTextContent('marker');
  });

  it('updates CSS position when left/top props change', () => {
    const { rerender } = render(
      <XYCanvas left={10} top={20}>
        <span>content</span>
      </XYCanvas>
    );

    expect(screen.getByTestId(selectors.components.UPlotChart.xyCanvas)).toHaveStyle({ left: '10px', top: '20px' });

    rerender(
      <XYCanvas left={30} top={40}>
        <span>content</span>
      </XYCanvas>
    );

    expect(screen.getByTestId(selectors.components.UPlotChart.xyCanvas)).toHaveStyle({ left: '30px', top: '40px' });
  });
});
