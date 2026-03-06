import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThresholdsMode, FieldConfig, FieldColorModeId, createTheme } from '@grafana/data';

import { Gauge, Props } from './Gauge';

const field: FieldConfig = {
  min: 0,
  max: 100,
  color: {
    mode: FieldColorModeId.Thresholds,
  },
  thresholds: {
    mode: ThresholdsMode.Absolute,
    steps: [{ value: -Infinity, color: '#7EB26D' }],
  },
  custom: {
    neeutral: 0,
  },
};

const props: Props = {
  showThresholdMarkers: true,
  showThresholdLabels: false,
  field,
  width: 300,
  height: 300,
  value: {
    text: '25',
    numeric: 25,
  },
  theme: createTheme({ colors: { mode: 'dark' } }),
};

describe('Gauge', () => {
  // Gauge.draw() logs "Invalid dimensions" in jsdom because elements have no real layout (width=0).
  // This is expected and not a real error.
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should render without blowing up', () => {
    expect(() => render(<Gauge {...props} />)).not.toThrow();
  });

  it('should render as a button when an onClick is provided', async () => {
    const mockOnClick = vi.fn();
    render(<Gauge {...props} onClick={mockOnClick} />);
    const gaugeButton = screen.getByRole('button');
    expect(gaugeButton).toBeInTheDocument();
    await userEvent.click(gaugeButton);
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });
});
