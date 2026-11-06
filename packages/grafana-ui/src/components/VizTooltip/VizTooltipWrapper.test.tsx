import { render, screen } from '@testing-library/react';

import { createTheme } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { VizTooltipRow } from './VizTooltipRow';
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
    it('caps the tooltip width at the sm breakpoint when size is "narrow"', () => {
      const theme = createTheme();
      render(<VizTooltipWrapper size="narrow">content</VizTooltipWrapper>);
      expect(screen.getByTestId(WRAPPER_TESTID)).toHaveStyle({ maxWidth: `${theme.breakpoints.values.sm}px` });
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

  // The wrapper provides its size via context; rows read it and flip their cell constraints. Render
  // the real wrapper + row tree so this exercises the wiring the way consumers hit it.
  describe('size propagation to descendant rows', () => {
    const cellOf = (text: string) => screen.getByText(text).parentElement;

    it('caps the name and the value each at 75% in narrow, so neither pushes the other out', () => {
      const value = 'a long value that should wrap rather than push the name off the tooltip';
      render(
        <VizTooltipWrapper size="narrow">
          <VizTooltipRow label="My Label" value={value} />
        </VizTooltipWrapper>
      );
      expect(cellOf('My Label')).toHaveStyle({ maxWidth: '75%' });
      expect(cellOf(value)).toHaveStyle({ maxWidth: '75%', marginLeft: 'auto', justifyContent: 'flex-end' });
    });

    it('keeps the old-system row layout for auto (value holds its width, no percentage caps)', () => {
      render(
        <VizTooltipWrapper size="auto">
          <VizTooltipRow label="My Label" value="My Value" />
        </VizTooltipWrapper>
      );
      expect(cellOf('My Value')).toHaveStyle({ flexShrink: 0 });
      expect(cellOf('My Label')).not.toHaveStyle({ maxWidth: '75%' });
      expect(cellOf('My Value')).not.toHaveStyle({ maxWidth: '75%' });
    });
  });
});
