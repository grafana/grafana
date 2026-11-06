import { render, screen } from '@testing-library/react';

import { createTheme } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { VizTooltipWrapper } from './VizTooltipWrapper';

const WRAPPER_TESTID = selectors.components.Panels.Visualization.Tooltip.Wrapper;

describe('VizTooltipWrapper', () => {
  it('renders its children', () => {
    render(
      <VizTooltipWrapper>
        <div data-testid="child">tooltip body</div>
      </VizTooltipWrapper>
    );
    expect(screen.getByTestId('child')).toHaveTextContent('tooltip body');
  });

  it('exposes the tooltip wrapper e2e selector', () => {
    render(<VizTooltipWrapper>content</VizTooltipWrapper>);
    expect(screen.getByTestId(WRAPPER_TESTID)).toBeInTheDocument();
  });

  it('lays its content out as a vertical flex column at the bodySmall font size', () => {
    const theme = createTheme();
    render(<VizTooltipWrapper>content</VizTooltipWrapper>);
    expect(screen.getByTestId(WRAPPER_TESTID)).toHaveStyle({
      display: 'flex',
      flexDirection: 'column',
      fontSize: theme.typography.bodySmall.fontSize,
    });
  });

  it('does not cap its width, so the tooltip grows to fit its content', () => {
    render(<VizTooltipWrapper>content</VizTooltipWrapper>);
    const wrapper = screen.getByTestId(WRAPPER_TESTID);
    expect(wrapper).toHaveTextContent('content');
    // old-system contract: no numeric max-width (`none`/unset) — a px/% cap would regress `auto`
    expect(getComputedStyle(wrapper).maxWidth).not.toMatch(/\d/);
  });

  it('merges a provided className with its own styles', () => {
    render(<VizTooltipWrapper className="custom-class">content</VizTooltipWrapper>);
    expect(screen.getByTestId(WRAPPER_TESTID)).toHaveClass('custom-class');
  });

  describe('size prop', () => {
    it('throws when size is "narrow" because it is not implemented yet', () => {
      // A throw during render makes React log to console.error; silence it so the repo's
      // jest-fail-on-console setup doesn't flag this (intentionally throwing) test.
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(<VizTooltipWrapper size="narrow">content</VizTooltipWrapper>)).toThrow(/narrow/);
      consoleError.mockRestore();
    });

    it('renders the same uncapped flex column for size="auto" as with no size prop', () => {
      const theme = createTheme();
      render(<VizTooltipWrapper size="auto">content</VizTooltipWrapper>);
      const wrapper = screen.getByTestId(WRAPPER_TESTID);
      expect(wrapper).toHaveStyle({
        display: 'flex',
        flexDirection: 'column',
        fontSize: theme.typography.bodySmall.fontSize,
      });
      expect(getComputedStyle(wrapper).maxWidth).not.toMatch(/\d/);
    });
  });
});
