import { render, screen, within } from '@testing-library/react';
import React from 'react';

import { DataFrame, FieldType, getDefaultTimeRange, InternalTimeZones, toDataFrame } from '@grafana/data';
import { ExploreId } from 'app/types';

import { TableContainer } from './TableContainer';

function getTable(): HTMLElement {
  return screen.getAllByRole('table')[0];
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
  exploreId: ExploreId.left,
  loading: false,
  width: 800,
  onCellFilterAdded: jest.fn(),
  tableResult: [dataFrame],
  splitOpenFn: () => {},
  range: getDefaultTimeRange(),
  timeZone: InternalTimeZones.utc,
};

describe('TableContainer', () => {
  it('should render component', () => {
    render(<TableContainer {...defaultProps} />);
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

  it('should render 0 series returned on no items', () => {
    const emptyFrames: DataFrame[] = [
      {
        name: 'TableResultName',
        fields: [],
        length: 0,
      },
    ];
    render(<TableContainer {...defaultProps} tableResult={emptyFrames} />);
    expect(screen.getByText('0 series returned')).toBeInTheDocument();
  });

  it('should update time when timezone changes', () => {
    const { rerender } = render(<TableContainer {...defaultProps} />);
    const rowsBeforeChange = within(getTable()).getAllByRole('row');
    expect(getRowsData(rowsBeforeChange)).toEqual([
      { time: '2021-01-01 00:00:00', text: 'test_string_1' },
      { time: '2021-01-01 03:00:00', text: 'test_string_2' },
      { time: '2021-01-01 01:00:00', text: 'test_string_3' },
      { time: '2021-01-01 02:00:00', text: 'test_string_4' },
    ]);

    rerender(<TableContainer {...defaultProps} timeZone="cest" />);
    const rowsAfterChange = within(getTable()).getAllByRole('row');
    expect(getRowsData(rowsAfterChange)).toEqual([
      { time: '2020-12-31 19:00:00', text: 'test_string_1' },
      { time: '2020-12-31 22:00:00', text: 'test_string_2' },
      { time: '2020-12-31 20:00:00', text: 'test_string_3' },
      { time: '2020-12-31 21:00:00', text: 'test_string_4' },
    ]);
  });
});
