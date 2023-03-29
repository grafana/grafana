import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';

import { FieldType, getDefaultTimeRange, InternalTimeZones, toDataFrame } from '@grafana/data';
import { TABLE_RESULTS_STYLE } from 'app/types/explore';

import { RawPrometheusContainer } from './RawPrometheusContainer';

function getTable(): HTMLElement {
  return screen.getAllByRole('table')[0];
}

function getTableToggle(): HTMLElement {
  return screen.getAllByRole('radio')[0];
}

function getRowsData(rows: HTMLElement[]): Object[] {
  let content = [];
  for (let i = 1; i < rows.length; i++) {
    content.push({
      time: within(rows[i]).getByText(/2021*/).textContent,
      text: within(rows[i]).getByText(/test_string_*/).textContent,
    });
  }
  return content;
}

const dataFrame = toDataFrame({
  name: 'A',
  fields: [
    {
      name: 'time',
      type: FieldType.time,
      values: [1609459200000, 1609470000000, 1609462800000, 1609466400000],
      config: {
        custom: {
          filterable: false,
        },
      },
    },
    {
      name: 'text',
      type: FieldType.string,
      values: ['test_string_1', 'test_string_2', 'test_string_3', 'test_string_4'],
      config: {
        custom: {
          filterable: false,
        },
      },
    },
  ],
});

const defaultProps = {
  exploreId: 'left',
  loading: false,
  width: 800,
  onCellFilterAdded: jest.fn(),
  tableResult: [dataFrame],
  splitOpenFn: () => {},
  range: getDefaultTimeRange(),
  timeZone: InternalTimeZones.utc,
  resultsStyle: TABLE_RESULTS_STYLE.raw,
  showRawPrometheus: false,
};

describe('RawPrometheusContainer', () => {
  it('should render component for prometheus', () => {
    render(<RawPrometheusContainer {...defaultProps} showRawPrometheus={true} />);

    expect(screen.queryAllByRole('table').length).toBe(1);
    fireEvent.click(getTableToggle());

    expect(getTable()).toBeInTheDocument();
    const rows = within(getTable()).getAllByRole('row');
    expect(rows).toHaveLength(5);
    expect(getRowsData(rows)).toEqual([
      { time: '2021-01-01 00:00:00', text: 'test_string_1' },
      { time: '2021-01-01 03:00:00', text: 'test_string_2' },
      { time: '2021-01-01 01:00:00', text: 'test_string_3' },
      { time: '2021-01-01 02:00:00', text: 'test_string_4' },
    ]);
  });
});
