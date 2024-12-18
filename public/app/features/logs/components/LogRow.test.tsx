import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentProps } from 'react';
import tinycolor from 'tinycolor2';

import { CoreApp, createTheme, LogLevel, LogRowModel } from '@grafana/data';

import { LogRow } from './LogRow';
import { createLogRow } from './__mocks__/logRow';
import { getLogRowStyles } from './getLogRowStyles';

const reportInteraction = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: (interactionName: string, properties?: Record<string, unknown> | undefined) =>
    reportInteraction(interactionName, properties),
}));

const theme = createTheme();
const styles = getLogRowStyles(theme);
const setup = (propOverrides?: Partial<ComponentProps<typeof LogRow>>, rowOverrides?: Partial<LogRowModel>) => {
  const props: ComponentProps<typeof LogRow> = {
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
    handleTextSelection: jest.fn(),
    prettifyLogMessage: false,
    app: CoreApp.Explore,
    showDuplicates: false,
    showLabels: false,
    showTime: false,
    wrapLogMessage: false,
    timeZone: 'utc',
    styles,
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
    it('reports via feature tracking when log line matches', () => {
      const scrollIntoView = jest.fn();
      setup({ permalinkedRowId: 'log-row-id', scrollIntoView });
      expect(reportInteraction).toHaveBeenCalledWith('grafana_explore_logs_permalink_opened', {
        logRowUid: 'log-row-id',
        datasourceType: 'unknown',
      });
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
    });

    it('highlights row with same permalink-id', () => {
      const { container } = setup({
        permalinkedRowId: 'log-row-id',
        scrollIntoView: jest.fn(),
      });
      const row = container.querySelector('tr');
      expect(row).toHaveStyle(
        `background-color: ${tinycolor(theme.colors.info.transparent).setAlpha(0.25).toString()}`
      );
    });

    it('does not highlight row details with different permalink-id', async () => {
      const { container } = setup({
        permalinkedRowId: 'log-row-id',
        enableLogDetails: true,
        scrollIntoView: jest.fn(),
      });
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

    it('does not call `scrollIntoView` if permalink does not match', () => {
      const scrollIntoView = jest.fn();
      setup({ permalinkedRowId: 'wrong-log-row-id', scrollIntoView });
      expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it('calls `scrollIntoView` once', async () => {
      const scrollIntoView = jest.fn();
      setup({ permalinkedRowId: 'log-row-id', scrollIntoView });
      await userEvent.hover(screen.getByText('test123'));
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
    });
  });

  it('should render the menu cell on mouse over', async () => {
    setup({ showContextToggle: jest.fn().mockReturnValue(true) });

    expect(screen.queryByLabelText('Show context')).not.toBeInTheDocument();

    await userEvent.hover(screen.getByText('test123'));

    expect(screen.getByLabelText('Show context')).toBeInTheDocument();
  });

  it('should render the menu cell on mouse over with displayed fields', async () => {
    setup(
      { showContextToggle: jest.fn().mockReturnValue(true), displayedFields: ['test'] },
      { labels: { test: 'field value' } }
    );

    expect(screen.queryByLabelText('Show context')).not.toBeInTheDocument();

    await userEvent.hover(screen.getByText('test=field value'));

    expect(screen.getByLabelText('Show context')).toBeInTheDocument();
  });

  it('should highlight the original log row when showing its context', async () => {
    const { container } = setup({ showContextToggle: jest.fn().mockReturnValue(true) });

    await userEvent.hover(screen.getByText('test123'));
    await userEvent.click(screen.getByLabelText('Show context'));
    await userEvent.unhover(screen.getByText('test123'));

    const row = container.querySelector('tr');
    expect(row).toHaveStyle(`background-color: ${tinycolor(theme.colors.info.transparent).setAlpha(0.25).toString()}`);
  });
});
