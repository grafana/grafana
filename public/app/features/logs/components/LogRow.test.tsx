import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import tinycolor from 'tinycolor2';

import { CoreApp, createTheme, LogLevel, LogRowModel } from '@grafana/data';

import { LogRow, Props } from './LogRow';
import { createLogRow } from './__mocks__/logRow';
import { getLogRowStyles } from './getLogRowStyles';

const theme = createTheme();
const styles = getLogRowStyles(theme);
const setup = (propOverrides?: Partial<Props>, rowOverrides?: Partial<LogRowModel>) => {
  const props: Props = {
    row: createLogRow({
      entry: 'test123',
      uid: 'log-row-id',
      logLevel: LogLevel.error,
      timeEpochMs: 1546297200000,
      ...rowOverrides,
    }),
    enableLogDetails: false,
    getRows: () => [],
    onOpenContext: () => {},
    prettifyLogMessage: false,
    app: CoreApp.Explore,
    showDuplicates: false,
    showLabels: false,
    showTime: false,
    wrapLogMessage: false,
    timeZone: 'utc',
    styles,
    theme,
    ...(propOverrides || {}),
  };

  const { container } = render(
    <table>
      <tbody>
        <LogRow {...props} />
      </tbody>
    </table>
  );

  return { props, container };
};

describe('LogRow', () => {
  it('renders row entry', () => {
    setup();
    expect(screen.queryByText('test123')).toBeInTheDocument();
  });

  describe('with permalinking', () => {
    it('highlights row with same permalink-id', () => {
      const { container } = setup({ permalinkedRowId: 'log-row-id' });
      const row = container.querySelector('tr');
      expect(row).toHaveStyle(
        `background-color: ${tinycolor(theme.colors.info.transparent).setAlpha(0.25).toString()}`
      );
    });

    it('does not highlight row details with same permalink-id', async () => {
      const { container } = setup({ permalinkedRowId: 'log-row-id', enableLogDetails: true });
      const row = container.querySelector('tr');
      await userEvent.click(row!);
      const allRows = container.querySelectorAll('tr');

      expect(row).toHaveStyle(
        `background-color: ${tinycolor(theme.colors.info.transparent).setAlpha(0.25).toString()}`
      );
      expect(allRows[allRows.length - 1]).not.toHaveStyle(
        `background-color: ${tinycolor(theme.colors.info.transparent).setAlpha(0.25).toString()}`
      );
    });

    it('not highlights row with different permalink-id', () => {
      const { container } = setup({ permalinkedRowId: 'wrong-log-row-id' });
      const row = container.querySelector('tr');
      expect(row).not.toHaveStyle(
        `background-color: ${tinycolor(theme.colors.info.transparent).setAlpha(0.25).toString()}`
      );
    });

    it('calls `scrollIntoView` if permalink matches', () => {
      const scrollIntoView = jest.fn();
      setup({ permalinkedRowId: 'log-row-id', scrollIntoView });
      expect(scrollIntoView).toHaveBeenCalled();
    });

    it('not calls `scrollIntoView` if permalink does not match', () => {
      const scrollIntoView = jest.fn();
      setup({ permalinkedRowId: 'wrong-log-row-id', scrollIntoView });
      expect(scrollIntoView).not.toHaveBeenCalled();
    });
  });
});
