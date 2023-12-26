import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { times } from 'lodash';
import React from 'react';

import { DataFrame, toDataFrame } from '@grafana/data';

import { ExpressionResult, getGroupedByStateAndSeriesCount } from './Expression';

describe('TestResult', () => {
  it('should be able to render', () => {
    expect(() => {
      render(<ExpressionResult series={[]} />);
    }).not.toThrow();
  });

  it('should show labels and values', () => {
    const series: DataFrame[] = [
      toDataFrame({ fields: [{ name: 'temp', values: [0.1234], labels: { label1: 'value1', label2: 'value2' } }] }),
      toDataFrame({ fields: [{ name: 'temp', values: [0.5678], labels: { label1: 'value3', label2: 'value4' } }] }),
    ];
    render(<ExpressionResult series={series} />);

    expect(screen.getByTitle('{label1=value1, label2=value2}')).toBeInTheDocument();
    expect(screen.getByText('0.1234')).toBeInTheDocument();

    expect(screen.getByTitle('{label1=value3, label2=value4}')).toBeInTheDocument();
    expect(screen.getByText('0.5678')).toBeInTheDocument();
  });

  it('should not paginate with less than PAGE_SIZE', () => {
    const series: DataFrame[] = [
      toDataFrame({
        fields: [
          {
            name: 'temp',
            values: [23, 11, 10],
          },
        ],
      }),
    ];

    render(<ExpressionResult series={series} />);
    expect(screen.queryByTestId('paginate-expression')).not.toBeInTheDocument();
  });

  it('should paginate with greater than PAGE_SIZE', async () => {
    const series: DataFrame[] = makeSeries(50);

    render(<ExpressionResult series={series} />);
    expect(screen.getByTestId('paginate-expression')).toBeInTheDocument();
    expect(screen.getByText(`1 - 20 of ${50}`)).toBeInTheDocument();

    // click previous page
    await userEvent.click(screen.getByLabelText('previous-page'));
    expect(screen.getByText(`1 - 20 of ${50}`)).toBeInTheDocument();

    // keep clicking next page, should clamp
    await userEvent.click(screen.getByLabelText('next-page'));
    expect(screen.getByText(`21 - 40 of ${50}`)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('next-page'));
    expect(screen.getByText(`41 - 50 of ${50}`)).toBeInTheDocument();
    // click one more time, should still be on the last page
    await userEvent.click(screen.getByLabelText('next-page'));
    expect(screen.getByText(`41 - 50 of ${50}`)).toBeInTheDocument();
  });
});

function makeSeries(n: number) {
  return times(n, () =>
    toDataFrame({
      fields: [
        {
          name: 'temp',
          values: [0.1234],
          labels: {
            label1: 'value1',
            label2: 'value2',
          },
        },
      ],
    })
  );
}

describe('getGroupedByStateAndSeriesCount', () => {
  it('should group series by state correctly and count the number of series', () => {
    const series: DataFrame[] = [
      toDataFrame({ fields: [{ name: 'value', values: [1] }] }),
      toDataFrame({ fields: [{ name: 'value', values: [undefined] }] }),
      toDataFrame({ fields: [{ name: 'value', values: [0] }] }),
      toDataFrame({ fields: [{ name: 'value', values: [2] }] }),
      toDataFrame({ fields: [{ name: 'value', values: [undefined] }] }),
    ];

    const { groupedByState, seriesCount } = getGroupedByStateAndSeriesCount(series);

    expect(groupedByState['firing']).toEqual([series[0], series[3]]);
    expect(groupedByState['inactive']).toEqual([series[2]]);
    expect(seriesCount).toEqual(3);
  });

  it('should return empty group state and zero series count when input array is empty', () => {
    const series: DataFrame[] = [];

    const { groupedByState, seriesCount } = getGroupedByStateAndSeriesCount(series);

    expect(groupedByState).toEqual({
      firing: [],
      inactive: [],
    });
    expect(seriesCount).toEqual(0);
  });

  it('should return zero series count and empty group state when all series have undefined values', () => {
    const series = [
      toDataFrame({ fields: [{ name: 'value', values: [undefined] }] }),
      toDataFrame({ fields: [{ name: 'value', values: [undefined] }] }),
    ];

    const { groupedByState, seriesCount } = getGroupedByStateAndSeriesCount(series);

    expect(groupedByState['firing']).toEqual([]);
    expect(groupedByState['inactive']).toEqual([]);
    expect(seriesCount).toEqual(0);
  });

  it('should group all series by inactive state when all series have zero values', () => {
    const series = [
      toDataFrame({ fields: [{ name: 'value', values: [0] }] }),
      toDataFrame({ fields: [{ name: 'value', values: [0] }] }),
      toDataFrame({ fields: [{ name: 'value', values: [0] }] }),
    ];

    const { groupedByState, seriesCount } = getGroupedByStateAndSeriesCount(series);

    expect(groupedByState['firing']).toEqual([]);
    expect(groupedByState['inactive']).toEqual(series);
    expect(seriesCount).toEqual(series.length);
  });

  it('should group all series by Firing state when all series have non-zero values', () => {
    const series = [
      toDataFrame({ fields: [{ name: 'value', values: [1] }] }),
      toDataFrame({ fields: [{ name: 'value', values: [2] }] }),
      toDataFrame({ fields: [{ name: 'value', values: [3] }] }),
    ];

    const { groupedByState, seriesCount } = getGroupedByStateAndSeriesCount(series);

    expect(groupedByState['firing']).toEqual(series);
    expect(groupedByState['inactive']).toEqual([]);
    expect(seriesCount).toEqual(series.length);
  });
});
