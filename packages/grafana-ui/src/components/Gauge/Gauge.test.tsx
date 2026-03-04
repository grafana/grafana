import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThresholdsMode, FieldConfig, FieldColorModeId, createTheme } from '@grafana/data';

import { Gauge, Props } from './Gauge';

jest.mock('jquery', () => ({
  plot: jest.fn(),
}));

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
  it('should render without blowing up', () => {
    expect(() => render(<Gauge {...props} />)).not.toThrow();
  });

  it('should render as a button when an onClick is provided', async () => {
    const mockOnClick = jest.fn();
    render(<Gauge {...props} onClick={mockOnClick} />);
    const gaugeButton = screen.getByRole('button');
    expect(gaugeButton).toBeInTheDocument();
    await userEvent.click(gaugeButton);
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('should correctly handle percentage thresholds with percentunit', () => {
    const percentunitField: FieldConfig = {
      min: 0,
      max: 1,
      unit: 'percentunit',
      thresholds: {
        mode: ThresholdsMode.Percentage,
        steps: [
          { value: 0, color: 'red' },
          { value: 90, color: 'green' },
        ],
      },
    };

    const percentunitProps: Props = {
      ...props,
      field: percentunitField,
      value: {
        text: '97.1%',
        numeric: 0.971,
        percent: 0.971,
      },
    };

    expect(() => render(<Gauge {...percentunitProps} />)).not.toThrow();
  });
});
