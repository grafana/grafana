import { render, screen } from '@testing-library/react';
import React from 'react';

import { LogRowModel, LogsSortOrder } from '@grafana/data';

import { LogGroupPosition, LogRowContextGroup } from './LogRowContext';

describe('LogRowContextGroup component', () => {
  it('should correctly render logs with ANSI', () => {
    const defaultProps = {
      rows: ['Log 1 with \u001B[31mANSI\u001B[0m code', 'Log 2', 'Log 3 with \u001B[31mANSI\u001B[0m code'],
      onLoadMoreContext: () => {},
      canLoadMoreRows: false,
      row: {} as LogRowModel,
      className: '',
      groupPosition: LogGroupPosition.Top,
    };

    render(<LogRowContextGroup {...defaultProps} />);
    expect(screen.getAllByTestId('ansiLogLine')).toHaveLength(2);
  });

  it.each([
    [LogGroupPosition.Top, LogsSortOrder.Ascending, 'before'],
    [LogGroupPosition.Top, LogsSortOrder.Descending, 'after'],
    [LogGroupPosition.Bottom, LogsSortOrder.Ascending, 'after'],
    [LogGroupPosition.Bottom, LogsSortOrder.Descending, 'before'],
  ])(`should when component is %s and sorting is %s display '%s'`, async (groupPosition, logsSortOrder, expected) => {
    const defaultProps = {
      rows: ['Log 1', 'Log 2', 'Log 3'],
      onLoadMoreContext: () => {},
      canLoadMoreRows: false,
      row: {} as LogRowModel,
      className: '',
      groupPosition,
      logsSortOrder,
    };

    render(<LogRowContextGroup {...defaultProps} />);

    expect(await screen.findByText(`Showing 3 lines ${expected} match.`)).toBeInTheDocument();
  });
});
