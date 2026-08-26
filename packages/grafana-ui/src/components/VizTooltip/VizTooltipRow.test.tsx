import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VizTooltipRow } from './VizTooltipRow';
import { VizTooltipColorIndicator, VizTooltipColorPlacement, type VizTooltipDelta } from './types';

// VizTooltipRow decides between the async clipboard API and its execCommand fallback once, at module
// load. jsdom is not a secure context by default, which would route copy tests through the fallback
// (whose textarea is appended to the label element, so it silently no-ops when there is no label).
// Presenting a secure context before the module loads keeps the copy tests on the path real users
// hit. `writeTextMock` is asserted directly, so this cannot pass vacuously.
jest.mock('./VizTooltipRow', () => {
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  Object.defineProperty(navigator, 'clipboard', {
    // resolved lazily: this factory is hoisted above the writeTextMock declaration
    value: { writeText: (text: string) => writeTextMock(text) },
    configurable: true,
  });
  return jest.requireActual('./VizTooltipRow');
});

const writeTextMock = jest.fn<Promise<void>, [string]>();

const defaultProps = {
  label: 'My Label',
  value: 'My Value',
};

beforeEach(() => {
  writeTextMock.mockReset();
  writeTextMock.mockResolvedValue(undefined);
});

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
          colorIndicator={VizTooltipColorIndicator.series}
          colorPlacement={VizTooltipColorPlacement.first}
        />
      );
      expect(screen.getByTestId('series-icon')).toBeInTheDocument();
    });

    it('renders a color indicator at leading position inside value wrapper', () => {
      render(
        <VizTooltipRow
          {...defaultProps}
          color="#ff0000"
          colorIndicator={VizTooltipColorIndicator.series}
          colorPlacement={VizTooltipColorPlacement.leading}
        />
      );
      expect(screen.getByTestId('series-icon')).toBeInTheDocument();
    });

    it('renders a color indicator at trailing position', () => {
      render(
        <VizTooltipRow
          {...defaultProps}
          color="#ff0000"
          colorIndicator={VizTooltipColorIndicator.series}
          colorPlacement={VizTooltipColorPlacement.trailing}
        />
      );
      expect(screen.getByTestId('series-icon')).toBeInTheDocument();
    });

    it('does not render a color indicator when color is not provided', () => {
      render(<VizTooltipRow {...defaultProps} colorPlacement={VizTooltipColorPlacement.first} />);
      expect(screen.queryByTestId('series-icon')).not.toBeInTheDocument();
    });

    it('does not render a color indicator when colorPlacement is hidden', () => {
      render(
        <VizTooltipRow
          {...defaultProps}
          color="#ff0000"
          colorIndicator={VizTooltipColorIndicator.series}
          colorPlacement={VizTooltipColorPlacement.hidden}
        />
      );
      expect(screen.queryByTestId('series-icon')).not.toBeInTheDocument();
    });
  });

  describe('pinned vs unpinned', () => {
    it('renders label as plain text when not pinned', () => {
      render(<VizTooltipRow {...defaultProps} />);
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

  describe('time comparison delta', () => {
    // Frozen literals from the default (dark) theme: colors.success.text / colors.error.text.
    const SUCCESS_TEXT = '#6ccf8e';
    const ERROR_TEXT = '#ff5286';

    it('prefixes a positive delta with a plus sign and wraps it in parentheses', () => {
      // the sign is added here, not by the formatter, so it is worth pinning
      render(<VizTooltipRow {...defaultProps} delta={{ text: '5', numeric: 5 }} />);
      expect(screen.getByText('(+5)')).toBeInTheDocument();
    });

    it('renders a positive delta in the success text color', () => {
      render(<VizTooltipRow {...defaultProps} delta={{ text: '5', numeric: 5 }} />);
      expect(screen.getByText('(+5)')).toHaveStyle({ color: SUCCESS_TEXT });
    });

    it('renders a negative delta in the error text color, without adding a sign', () => {
      // formatters already emit the '-', so it must not be doubled up
      render(<VizTooltipRow {...defaultProps} delta={{ text: '-2', numeric: -2 }} />);
      expect(screen.getByText('(-2)')).toHaveStyle({ color: ERROR_TEXT });
    });

    it('renders a zero delta in neither the success nor the error color', () => {
      render(<VizTooltipRow {...defaultProps} delta={{ text: '0', numeric: 0 }} />);

      const delta = screen.getByText('(0)');
      expect(delta).not.toHaveStyle({ color: SUCCESS_TEXT });
      expect(delta).not.toHaveStyle({ color: ERROR_TEXT });
    });

    it('renders a non-numeric delta uncolored rather than as a decrease', () => {
      render(<VizTooltipRow {...defaultProps} delta={{ text: 'NaN', numeric: NaN }} />);

      const delta = screen.getByText('(NaN)');
      expect(delta).not.toHaveStyle({ color: SUCCESS_TEXT });
      expect(delta).not.toHaveStyle({ color: ERROR_TEXT });
    });

    it('keeps the unit formatting carried by the delta text', () => {
      render(<VizTooltipRow {...defaultProps} delta={{ text: '5 B', numeric: 5 }} />);
      expect(screen.getByText('(+5 B)')).toBeInTheDocument();
    });

    it('renders no delta element when there is no delta', () => {
      render(<VizTooltipRow {...defaultProps} />);
      expect(screen.queryByText(/^\(/)).not.toBeInTheDocument();
    });

    /**
     * `label` is left empty on purpose: the pinned label branch passes a Fragment to `Tooltip`,
     * which logs a React ref warning (pre-existing, unrelated to copying) that would fail the
     * suite via jest-fail-on-console.
     */
    async function copyPinnedValue(props: { value: string; delta?: VizTooltipDelta }) {
      render(<VizTooltipRow {...defaultProps} label="" isPinned={true} {...props} />);
      await userEvent.click(screen.getByText(props.value));
    }

    // Guards why value stays a string: splitting the delta out must not degrade pinned copy to
    // '[object Object]' (which a ReactNode value would) or silently drop the delta.
    it('copies value and delta together when pinned', async () => {
      await copyPinnedValue({ value: '25', delta: { text: '5', numeric: 5 } });
      expect(writeTextMock).toHaveBeenCalledWith('25 (+5)');
    });

    it('copies just the value when pinned and there is no delta', async () => {
      await copyPinnedValue({ value: '25' });
      expect(writeTextMock).toHaveBeenCalledWith('25');
    });
  });

  describe('isHiddenFromViz', () => {
    it('renders a hollow color indicator when isHiddenFromViz is true', () => {
      const { container } = render(
        <VizTooltipRow
          {...defaultProps}
          color="#ff0000"
          colorIndicator={VizTooltipColorIndicator.series}
          colorPlacement={VizTooltipColorPlacement.first}
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
