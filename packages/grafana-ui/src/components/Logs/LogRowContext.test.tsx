import { render, screen } from '@testing-library/react';
import React from 'react';

import { LogRowModel } from '@grafana/data';

import { LogRowContextGroup } from './LogRowContext';

describe('LogRowContextGroup component', () => {
  it('should correctly render logs with ANSI', () => {
    const defaultProps = {
      rows: ['Log 1 with \u001B[31mANSI\u001B[0m code', 'Log 2', 'Log 3 with \u001B[31mANSI\u001B[0m code'],
      onLoadMoreContext: () => {},
      canLoadMoreRows: false,
      row: {} as LogRowModel,
      className: '',
    };

    render(
      <div>
        <LogRowContextGroup {...defaultProps} />
      </div>
    );
    expect(screen.getAllByTestId('ansiLogLine')).toHaveLength(2);
  });
});
