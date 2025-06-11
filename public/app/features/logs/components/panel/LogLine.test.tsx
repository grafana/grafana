import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CoreApp, createTheme, LogsDedupStrategy, LogsSortOrder } from '@grafana/data';

import { LOG_LINE_BODY_FIELD_NAME } from '../LogDetailsBody';
import { createLogLine } from '../__mocks__/logRow';

import { getStyles, LogLine, Props } from './LogLine';
import { LogListFontSize } from './LogList';
import { LogListContextProvider } from './LogListContext';
import { defaultProps } from './__mocks__/LogListContext';
import { LogListModel } from './processing';
import { getTruncationLength } from './virtualization';

jest.mock('./LogListContext');
jest.mock('./virtualization');

const theme = createTheme();
const styles = getStyles(theme);
const contextProps = {
  ...defaultProps,
  app: CoreApp.Unknown,
  dedupStrategy: LogsDedupStrategy.exact,
  displayedFields: [],
  showControls: false,
  showTime: false,
  sortOrder: LogsSortOrder.Ascending,
  wrapLogMessage: false,
};
const fontSizes: LogListFontSize[] = ['default', 'small'];

describe.each(fontSizes)('LogLine', (fontSize: LogListFontSize) => {
  let log: LogListModel, defaultProps: Props;
  beforeEach(() => {
    log = createLogLine({ labels: { place: 'luna' }, entry: `log message 1` });
    contextProps.logs = [log];
    contextProps.fontSize = fontSize;
    defaultProps = {
      displayedFields: [],
      index: 0,
      log,
      onClick: jest.fn(),
      showTime: true,
      style: {},
      styles: styles,
      wrapLogMessage: true,
    };
  });

  test('Renders a log line', () => {
    render(
      <LogListContextProvider {...contextProps}>
        <LogLine {...defaultProps} />
      </LogListContextProvider>
    );
    expect(screen.getByText(log.timestamp)).toBeInTheDocument();
    expect(screen.getByText('log message 1')).toBeInTheDocument();
  });

  test('Renders a log line with no timestamp', () => {
    render(
      <LogListContextProvider {...contextProps}>
        <LogLine {...defaultProps} showTime={false} />
      </LogListContextProvider>
    );
    expect(screen.queryByText(log.timestamp)).not.toBeInTheDocument();
    expect(screen.getByText('log message 1')).toBeInTheDocument();
  });

  test('Renders a log line with displayed fields', () => {
    render(
      <LogListContextProvider {...contextProps}>
        <LogLine {...defaultProps} displayedFields={['place']} />
      </LogListContextProvider>
    );
    expect(screen.getByText(log.timestamp)).toBeInTheDocument();
    expect(screen.queryByText(log.body)).not.toBeInTheDocument();
    expect(screen.getByText('luna')).toBeInTheDocument();
  });

  test('Renders a log line with body displayed fields', () => {
    render(
      <LogListContextProvider {...contextProps}>
        <LogLine {...defaultProps} displayedFields={['place', LOG_LINE_BODY_FIELD_NAME]} />
      </LogListContextProvider>
    );
    expect(screen.getByText(log.timestamp)).toBeInTheDocument();
    expect(screen.getByText('log message 1')).toBeInTheDocument();
    expect(screen.getByText('luna')).toBeInTheDocument();
  });

  test('Reports mouse over events', async () => {
    const onLogLineHover = jest.fn();
    render(
      <LogListContextProvider {...contextProps} onLogLineHover={onLogLineHover}>
        <LogLine {...defaultProps} />
      </LogListContextProvider>
    );
    await userEvent.hover(screen.getByText('log message 1'));
    expect(onLogLineHover).toHaveBeenCalledTimes(1);
  });

  test('Listens to on click events', async () => {
    const onClick = jest.fn();
    render(
      <LogListContextProvider {...contextProps}>
        <LogLine {...defaultProps} onClick={onClick} />
      </LogListContextProvider>
    );
    await userEvent.click(screen.getByText('log message 1'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('Shows the deduplication count', async () => {
    log.duplicates = 1;
    render(
      <LogListContextProvider {...contextProps} dedupStrategy={LogsDedupStrategy.signature}>
        <LogLine {...defaultProps} />
      </LogListContextProvider>
    );
    await screen.findByText('log message 1');
    expect(screen.getByText('2x')).toBeInTheDocument();
  });

  test('Shows log lines with errors', async () => {
    log.hasError = true;
    log.labels.__error__ = 'error message';
    jest.spyOn(log, 'errorMessage', 'get').mockReturnValue('error message');
    render(
      <LogListContextProvider {...contextProps} dedupStrategy={LogsDedupStrategy.signature} logs={[log]}>
        <LogLine {...defaultProps} />
      </LogListContextProvider>
    );
    await screen.findByText('log message 1');
    expect(screen.getByLabelText('Has errors')).toBeInTheDocument();
  });

  test('Shows sampled log lines', async () => {
    log.isSampled = true;
    log.labels.__adaptive_logs_sampled__ = 'true';
    jest.spyOn(log, 'sampledMessage', 'get').mockReturnValue('sampled message');
    render(
      <LogListContextProvider {...contextProps} dedupStrategy={LogsDedupStrategy.signature} logs={[log]}>
        <LogLine {...defaultProps} />
      </LogListContextProvider>
    );
    await screen.findByText('log message 1');
    expect(screen.getByLabelText('Is sampled')).toBeInTheDocument();
  });

  test('Does not falsely report sampled or errors in logs', async () => {
    render(
      <LogListContextProvider {...contextProps} dedupStrategy={LogsDedupStrategy.signature}>
        <LogLine {...defaultProps} />
      </LogListContextProvider>
    );
    await screen.findByText('log message 1');
    expect(screen.queryByLabelText('Has errors')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Is sampled')).not.toBeInTheDocument();
  });

  describe('Log line menu', () => {
    test('Renders a log line menu', async () => {
      render(
        <LogListContextProvider {...contextProps}>
          <LogLine {...defaultProps} />
        </LogListContextProvider>
      );
      expect(screen.queryByText('Copy log line')).not.toBeInTheDocument();
      await userEvent.click(screen.getByLabelText('Log menu'));
      expect(screen.getByText('Copy log line')).toBeInTheDocument();
    });
  });

  describe('Syntax highlighting', () => {
    beforeEach(() => {
      log = createLogLine({ labels: { place: 'luna' }, entry: `place="luna" 1ms 3 KB` });
    });

    test('Highlights relevant tokens in the log line', () => {
      render(
        <LogListContextProvider {...contextProps}>
          <LogLine {...defaultProps} log={log} />
        </LogListContextProvider>
      );
      expect(screen.getByText('place')).toBeInTheDocument();
      expect(screen.getByText('1ms')).toBeInTheDocument();
      expect(screen.getByText('3 KB')).toBeInTheDocument();
      expect(screen.queryByText(`place="luna" 1ms 3 KB`)).not.toBeInTheDocument();
    });

    test('Can be disabled', () => {
      render(
        <LogListContextProvider {...contextProps} syntaxHighlighting={false}>
          <LogLine {...defaultProps} log={log} />
        </LogListContextProvider>
      );
      expect(screen.getByText(`place="luna" 1ms 3 KB`)).toBeInTheDocument();
      expect(screen.queryByText('place')).not.toBeInTheDocument();
      expect(screen.queryByText('1ms')).not.toBeInTheDocument();
      expect(screen.queryByText('3 KB')).not.toBeInTheDocument();
    });

    test('Does not alter ANSI log lines', () => {
      log = createLogLine({ labels: { place: 'luna' }, entry: 'Lorem \u001B[31mipsum\u001B[0m et dolor' });
      log.hasAnsi = true;

      render(
        <LogListContextProvider {...contextProps} syntaxHighlighting={false}>
          <LogLine {...defaultProps} log={log} />
        </LogListContextProvider>
      );
      expect(screen.getByTestId('ansiLogLine')).toBeInTheDocument();
      expect(screen.queryByText(log.entry)).not.toBeInTheDocument();
    });
  });

  describe('Collapsible log lines', () => {
    beforeEach(() => {
      log = createLogLine({ labels: { place: 'luna' }, entry: `log message 1` });
      jest.mocked(getTruncationLength).mockReturnValue(5);
    });

    test('Logs are not collapsed by default', () => {
      render(
        <LogListContextProvider {...contextProps}>
          <LogLine {...defaultProps} />
        </LogListContextProvider>
      );
      expect(screen.queryByText('show less')).not.toBeInTheDocument();
      expect(screen.queryByText('show more')).not.toBeInTheDocument();
    });

    test('Logs are not collapsible when unwrapped', () => {
      log.collapsed = true;
      render(
        <LogListContextProvider {...contextProps}>
          <LogLine
            {...defaultProps}
            // Unwrapped logs
            wrapLogMessage={false}
          />
        </LogListContextProvider>
      );
      expect(screen.queryByText('show less')).not.toBeInTheDocument();
      expect(screen.queryByText('show more')).not.toBeInTheDocument();
    });

    test('Long logs can be collapsed and expanded', async () => {
      log.collapsed = true;
      render(
        <LogListContextProvider {...contextProps}>
          <LogLine {...defaultProps} log={log} />
        </LogListContextProvider>
      );
      expect(screen.getByText('show more')).toBeVisible();
      await userEvent.click(screen.getByText('show more'));
      expect(await screen.findByText('show less')).toBeInTheDocument();
      await userEvent.click(screen.getByText('show less'));
      expect(await screen.findByText('show more')).toBeInTheDocument();
    });

    test('When the collapsed state changes invokes a callback to update virtualized sizes', async () => {
      log.collapsed = true;
      const onOverflow = jest.fn();
      render(
        <LogListContextProvider {...contextProps}>
          <LogLine {...defaultProps} onOverflow={onOverflow} log={log} />
        </LogListContextProvider>
      );
      await userEvent.click(await screen.findByText('show more'));
      await userEvent.click(await screen.findByText('show less'));
      expect(onOverflow).toHaveBeenCalledTimes(2);
    });

    test('Syncs the collapsed state with collapsed status changes in the log', async () => {
      log.collapsed = true;
      const { rerender } = render(<LogLine {...defaultProps} log={log} />);
      expect(screen.getByText('show more')).toBeVisible();

      log.collapsed = undefined;
      rerender(
        <LogListContextProvider {...contextProps}>
          <LogLine {...defaultProps} log={log} />
        </LogListContextProvider>
      );

      expect(screen.queryByText('show more')).not.toBeInTheDocument();
      expect(screen.queryByText('show less')).not.toBeInTheDocument();
    });

    test('Syncs the collapsed state with wrapping changes', async () => {
      log.collapsed = true;
      const { rerender } = render(
        <LogListContextProvider {...contextProps}>
          <LogLine {...defaultProps} log={log} />
        </LogListContextProvider>
      );
      expect(screen.getByText('show more')).toBeVisible();

      rerender(
        <LogListContextProvider {...contextProps}>
          <LogLine {...defaultProps} log={log} wrapLogMessage={false} />
        </LogListContextProvider>
      );

      expect(screen.queryByText('show more')).not.toBeInTheDocument();
      expect(screen.queryByText('show less')).not.toBeInTheDocument();
    });
  });
});
