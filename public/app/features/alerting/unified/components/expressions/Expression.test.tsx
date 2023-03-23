import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { times } from 'lodash';
import React from 'react';

import { DataFrame, toDataFrame } from '@grafana/data';

import { ExpressionResult } from './Expression';

describe('TestResult', () => {
  it('should be able to render', () => {
    expect(() => {
      render(<ExpressionResult series={[]} />);
    }).not.toThrow();
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
          values: [1],
        },
      ],
    })
  );
}
