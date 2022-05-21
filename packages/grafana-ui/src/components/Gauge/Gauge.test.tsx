import { render } from '@testing-library/react';
import React from 'react';

import { ThresholdsMode, FieldConfig, FieldColorModeId } from '@grafana/data';

import { getTheme } from '../../themes';

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
  theme: getTheme(),
};

describe('Gauge', () => {
  it('should render without blowing up', () => {
    expect(() => render(<Gauge {...props} />)).not.toThrow();
  });
});
