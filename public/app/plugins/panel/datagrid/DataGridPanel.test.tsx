import { render, screen } from '@testing-library/react';
import React from 'react';

import { DataFrame, dateTime, EventBus, LoadingState } from '@grafana/data';

import { DataGridPanel } from './DataGridPanel';

describe('DataGrid', () => {
  describe('when there is no data', () => {
    it('renders without error', () => {
      window.ResizeObserver = jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
      }));

      const props = buildPanelProps();
      render(<DataGridPanel {...props} />);

      expect(screen.getByText(/Unable to render data/i)).toBeInTheDocument();
    });
  });
});

const buildPanelProps = (...df: DataFrame[]) => {
  const timeRange = {
    from: dateTime(),
    to: dateTime(),
    raw: {
      from: dateTime(),
      to: dateTime(),
    },
  };

  return {
    id: 1,
    title: 'DataGrid',
    options: { selectedSeries: 0 },
    data: {
      series: df,
      state: LoadingState.Done,
      timeRange,
    },
    timeRange,
    timeZone: 'browser',
    width: 500,
    height: 500,
    transparent: false,
    renderCounter: 0,
    onOptionsChange: jest.fn(),
    onFieldConfigChange: jest.fn(),
    onChangeTimeRange: jest.fn(),
    replaceVariables: jest.fn(),
    eventBus: {} as EventBus,
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
  };
};
