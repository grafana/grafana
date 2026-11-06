import { render, screen } from '@testing-library/react';

import { createTheme } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { VizTooltipRow } from './VizTooltipRow';
import { VizTooltipWrapper } from './VizTooltipWrapper';
import { type VizTooltipSize } from './types';

const WRAPPER_TESTID = selectors.components.Panels.Visualization.Tooltip.Wrapper;

// `narrow` is intentionally capped at the theme's `sm` breakpoint rather than a magic pixel value, so
// the expectation is derived from the same theme the component renders with: changing the breakpoint
// value must not break this test, but pointing `narrow` at a different token should.
const narrowMaxWidth = `${createTheme().breakpoints.values.sm}px`;

describe('VizTooltipWrapper', () => {
  describe('size prop', () => {
    it('caps the tooltip width at the theme sm breakpoint when size is narrow', () => {
      render(<VizTooltipWrapper size="narrow">content</VizTooltipWrapper>);
      expect(screen.getByTestId(WRAPPER_TESTID)).toHaveStyle({ maxWidth: narrowMaxWidth });
    });

    it.each([
      { desc: 'auto', size: 'auto' as const },
      { desc: 'the default (size prop omitted)', size: undefined },
    ])('leaves the tooltip width uncapped when size is $desc', ({ size }: { desc: string; size?: VizTooltipSize }) => {
      render(<VizTooltipWrapper size={size}>content</VizTooltipWrapper>);
      const wrapper = screen.getByTestId(WRAPPER_TESTID);
      expect(wrapper).toHaveTextContent('content');
      expect(wrapper).not.toHaveStyle({ maxWidth: narrowMaxWidth });
    });
  });

  // The wrapper provides its size through context; descendant rows flip which cell absorbs the
  // slack. Rendering the real wrapper + row tree (rather than the context directly) exercises that
  // wiring the way consumers hit it.
  describe('size propagation to descendant rows', () => {
    // The inline label/value sit inside the wrapper divs that carry the width constraints, so reach
    // those wrappers via the rendered text rather than coupling to generated class names.
    const labelWrapperOf = (labelText: string) => screen.getByText(labelText).parentElement;
    const valueWrapperOf = (valueText: string) => screen.getByText(valueText).parentElement;

    it('caps the label name at 75% and floors the value at 25% of the width when size is narrow', () => {
      const value = 'a long value that should wrap rather than widen the tooltip';
      render(
        <VizTooltipWrapper size="narrow">
          <VizTooltipRow label="My Label" value={value} />
        </VizTooltipWrapper>
      );
      expect(labelWrapperOf('My Label')).toHaveStyle({ maxWidth: '75%' });
      // value keeps a 25% floor and stays right-aligned within its cell, matching the auto layout
      expect(valueWrapperOf(value)).toHaveStyle({ minWidth: '25%', justifyContent: 'flex-end' });
    });

    it('leaves the label uncapped and the value holding its width when size is auto', () => {
      render(
        <VizTooltipWrapper size="auto">
          <VizTooltipRow label="My Label" value="My Value" />
        </VizTooltipWrapper>
      );
      // auto grows to fit: the value holds its width (does not shrink) and neither cell is % bound.
      expect(valueWrapperOf('My Value')).toHaveStyle({ flexShrink: 0 });
      expect(labelWrapperOf('My Label')).not.toHaveStyle({ maxWidth: '75%' });
      expect(valueWrapperOf('My Value')).not.toHaveStyle({ minWidth: '25%' });
    });
  });
});
