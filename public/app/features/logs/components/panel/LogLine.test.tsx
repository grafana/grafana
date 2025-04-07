import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CoreApp, createTheme, LogsDedupStrategy, LogsSortOrder } from '@grafana/data';

import { LOG_LINE_BODY_FIELD_NAME } from '../LogDetailsBody';
import { createLogLine } from '../__mocks__/logRow';

import { getStyles, LogLine } from './LogLine';
import { LogListContextProvider } from './LogListContext';
import { LogListModel } from './processing';

jest.mock('./LogListContext');

const theme = createTheme();
const styles = getStyles(theme);
const contextProps = {
  app: CoreApp.Unknown,
  dedupStrategy: LogsDedupStrategy.exact,
  displayedFields: [],
  logs: [],
  showControls: false,
  showTime: false,
  sortOrder: LogsSortOrder.Ascending,
  wrapLogMessage: false,
};

describe('LogLine', () => {
  let log: LogListModel;
  beforeEach(() => {
    log = createLogLine({ labels: { place: 'luna' }, entry: `log message 1` });
  });

  test('Renders a log line', () => {
    render(
      <LogLine
        displayedFields={[]}
        index={0}
        log={log}
        showTime={true}
        style={{}}
        styles={styles}
        wrapLogMessage={false}
      />
    );
    expect(screen.getByText(log.timestamp)).toBeInTheDocument();
    expect(screen.getByText('log message 1')).toBeInTheDocument();
  });

  test('Renders a log line with no timestamp', () => {
    render(
      <LogLine
        displayedFields={[]}
        index={0}
        log={log}
        showTime={false}
        style={{}}
        styles={styles}
        wrapLogMessage={false}
      />
    );
    expect(screen.queryByText(log.timestamp)).not.toBeInTheDocument();
    expect(screen.getByText('log message 1')).toBeInTheDocument();
  });

  test('Renders a log line with displayed fields', () => {
    render(
      <LogLine
        displayedFields={['place']}
        index={0}
        log={log}
        showTime={true}
        style={{}}
        styles={styles}
        wrapLogMessage={false}
      />
    );
    expect(screen.getByText(log.timestamp)).toBeInTheDocument();
    expect(screen.queryByText(log.body)).not.toBeInTheDocument();
    expect(screen.getByText('luna')).toBeInTheDocument();
  });

  test('Renders a log line with body displayed fields', () => {
    render(
      <LogLine
        displayedFields={['place', LOG_LINE_BODY_FIELD_NAME]}
        index={0}
        log={log}
        showTime={true}
        style={{}}
        styles={styles}
        wrapLogMessage={false}
      />
    );
    expect(screen.getByText(log.timestamp)).toBeInTheDocument();
    expect(screen.getByText('log message 1')).toBeInTheDocument();
    expect(screen.getByText('luna')).toBeInTheDocument();
  });

  describe('Log line menu', () => {
    test('Renders a log line menu', async () => {
      render(
        <LogLine
          displayedFields={[]}
          index={0}
          log={log}
          showTime={true}
          style={{}}
          styles={styles}
          wrapLogMessage={false}
        />
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
        <LogLine
          displayedFields={[]}
          index={0}
          log={log}
          showTime={true}
          style={{}}
          styles={styles}
          wrapLogMessage={false}
        />
      );
      expect(screen.getByText('place')).toBeInTheDocument();
      expect(screen.getByText('1ms')).toBeInTheDocument();
      expect(screen.getByText('3 KB')).toBeInTheDocument();
      expect(screen.queryByText(`place="luna" 1ms 3 KB`)).not.toBeInTheDocument();
    });

    test('Can be disabled', () => {
      render(
        <LogListContextProvider {...contextProps} syntaxHighlighting={false}>
          <LogLine
            displayedFields={[]}
            index={0}
            log={log}
            showTime={true}
            style={{}}
            styles={styles}
            wrapLogMessage={false}
          />
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
          <LogLine
            displayedFields={[]}
            index={0}
            log={log}
            showTime={true}
            style={{}}
            styles={styles}
            wrapLogMessage={false}
          />
        </LogListContextProvider>
      );
      expect(screen.getByTestId('ansiLogLine')).toBeInTheDocument();
      expect(screen.queryByText(log.entry)).not.toBeInTheDocument();
    });
  });
});
