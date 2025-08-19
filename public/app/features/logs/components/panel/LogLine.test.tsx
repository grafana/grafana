import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CoreApp, createTheme, LogsDedupStrategy, LogsSortOrder } from '@grafana/data';

import { LOG_LINE_BODY_FIELD_NAME } from '../LogDetailsBody';
import { createLogLine } from '../mocks/logRow';

import { getGridTemplateColumns, getStyles, LogLine, Props } from './LogLine';
import { LogListFontSize } from './LogList';
import { LogListContextProvider, LogListContext } from './LogListContext';
import { LogListSearchContext } from './LogListSearchContext';
import { defaultProps, defaultValue } from './__mocks__/LogListContext';
import { LogListModel } from './processing';
import { LogLineVirtualization } from './virtualization';

jest.mock('@grafana/assistant', () => ({
  ...jest.requireActual('@grafana/assistant'),
  useAssistant: jest.fn(() => [true, jest.fn()]),
}));

jest.mock('./LogListContext');
jest.mock('../LogDetails');

const theme = createTheme();
const virtualization = new LogLineVirtualization(theme, 'default');
const styles = getStyles(theme, virtualization);
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
    log = createLogLine(
      { labels: { place: 'luna' }, entry: `log message 1` },
      { escape: false, order: LogsSortOrder.Descending, timeZone: 'browser', virtualization, wrapLogMessage: true }
    );
    contextProps.logs = [log];
    contextProps.fontSize = fontSize;
    defaultProps = {
      displayedFields: [],
      index: 0,
      log,
      logs: [log],
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

  test('Renders a log line with millisecond timestamps', () => {
    log.timestamp = '2025-08-06 11:35:19.504';
    render(
      <LogListContext.Provider
        value={{
          ...defaultValue,
          timestampResolution: 'ms',
        }}
      >
        <LogLine {...defaultProps} />
      </LogListContext.Provider>
    );
    expect(screen.getByText('2025-08-06 11:35:19.504')).toBeInTheDocument();
  });

  test('Renders a log line with nanosecond timestamps', () => {
    log.timestamp = '2025-08-06 11:35:19.504';
    log.timeEpochMs = 1754472919504;
    log.timeEpochNs = '1754472919504133766';
    render(
      <LogListContext.Provider
        value={{
          ...defaultValue,
          timestampResolution: 'ns',
        }}
      >
        <LogLine {...defaultProps} />
      </LogListContext.Provider>
    );
    expect(screen.getByText('2025-08-06 11:35:19.504133766')).toBeInTheDocument();
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
      const virtualization = new LogLineVirtualization(theme, 'default');
      jest.spyOn(virtualization, 'getTruncationLength').mockReturnValue(5);
      log = createLogLine(
        { labels: { place: 'luna' }, entry: `log message 1` },
        { escape: false, order: LogsSortOrder.Descending, timeZone: 'browser', virtualization, wrapLogMessage: true }
      );
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

    test('When the collapsed state changes, the log line contents re-render', async () => {
      log.collapsed = true;
      log.raw = 'The full contents of the log line';
      
      render(
        <LogListContextProvider {...contextProps}>
          <LogLine {...defaultProps} log={log} />
        </LogListContextProvider>
      );

      expect(screen.queryByText(log.raw)).not.toBeInTheDocument();

      await userEvent.click(await screen.findByText('show more'));
      
      expect(screen.getByText(log.raw)).toBeInTheDocument();
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

  describe('Text search support', () => {
    test('Highlights search text in a highlighted log line', () => {
      log.setCurrentSearch('message');
      render(
        <LogListContextProvider {...contextProps} syntaxHighlighting={true}>
          <LogListSearchContext.Provider
            value={{
              hideSearch: jest.fn(),
              filterLogs: false,
              matchingUids: [log.uid],
              search: 'message',
              searchVisible: true,
              setMatchingUids: jest.fn(),
              setSearch: jest.fn(),
              showSearch: jest.fn(),
              toggleFilterLogs: jest.fn(),
            }}
          >
            <LogLine {...defaultProps} />
          </LogListSearchContext.Provider>
        </LogListContextProvider>
      );
      expect(screen.getByText(log.timestamp)).toBeInTheDocument();
      expect(screen.queryByText('log message 1')).not.toBeInTheDocument();
      expect(screen.getByText('message')).toBeInTheDocument();
    });

    test('Highlights search text in a non-highlighted log line', () => {
      render(
        <LogListContextProvider {...contextProps} syntaxHighlighting={false}>
          <LogListSearchContext.Provider
            value={{
              hideSearch: jest.fn(),
              filterLogs: false,
              matchingUids: [log.uid],
              search: 'message',
              searchVisible: true,
              setMatchingUids: jest.fn(),
              setSearch: jest.fn(),
              showSearch: jest.fn(),
              toggleFilterLogs: jest.fn(),
            }}
          >
            <LogLine {...defaultProps} />
          </LogListSearchContext.Provider>
        </LogListContextProvider>
      );
      expect(screen.getByText(log.timestamp)).toBeInTheDocument();
      expect(screen.queryByText('log message 1')).not.toBeInTheDocument();
      expect(screen.getByText('message')).toBeInTheDocument();
    });

    test('Highlights search text in a ANSI log lines', () => {
      log = createLogLine({ labels: { place: 'luna' }, entry: 'Lorem \u001B[31mipsum\u001B[0m et dolor' });
      log.hasAnsi = true;

      render(
        <LogListContextProvider {...contextProps} syntaxHighlighting={false}>
          <LogListSearchContext.Provider
            value={{
              hideSearch: jest.fn(),
              filterLogs: false,
              matchingUids: [log.uid],
              search: 'olo',
              searchVisible: true,
              setMatchingUids: jest.fn(),
              setSearch: jest.fn(),
              showSearch: jest.fn(),
              toggleFilterLogs: jest.fn(),
            }}
          >
            <LogLine {...defaultProps} log={log} />
          </LogListSearchContext.Provider>
        </LogListContextProvider>
      );
      expect(screen.getByTestId('ansiLogLine')).toBeInTheDocument();
      expect(screen.queryByText(log.entry)).not.toBeInTheDocument();
      expect(screen.getByText('olo')).toBeInTheDocument();
    });

    test('Highlights search text in displayed fields', () => {
      render(
        <LogListContextProvider {...contextProps} displayedFields={['place']}>
          <LogListSearchContext.Provider
            value={{
              hideSearch: jest.fn(),
              filterLogs: false,
              matchingUids: [log.uid],
              search: 'un',
              searchVisible: true,
              setMatchingUids: jest.fn(),
              setSearch: jest.fn(),
              showSearch: jest.fn(),
              toggleFilterLogs: jest.fn(),
            }}
          >
            <LogLine {...defaultProps} displayedFields={['place']} />
          </LogListSearchContext.Provider>
        </LogListContextProvider>
      );
      expect(screen.getByText(log.timestamp)).toBeInTheDocument();
      expect(screen.queryByText('log message 1')).not.toBeInTheDocument();
      expect(screen.queryByText('luna')).not.toBeInTheDocument();
      expect(screen.getByText('un')).toBeInTheDocument();
    });
  });

  describe('Inline details', () => {
    test('Details are not rendered if details mode is not inline', () => {
      render(
        <LogListContext.Provider
          value={{
            ...defaultValue,
            showDetails: [log],
            detailsMode: 'sidebar',
            detailsDisplayed: jest.fn().mockReturnValue(true),
          }}
        >
          <LogLine {...defaultProps} />
        </LogListContext.Provider>
      );
      expect(screen.queryByPlaceholderText('Search field names and values')).not.toBeInTheDocument();
    });

    test('Details are rendered if details mode is inline', () => {
      render(
        <LogListContext.Provider
          value={{
            ...defaultValue,
            showDetails: [log],
            detailsMode: 'inline',
            detailsDisplayed: jest.fn().mockReturnValue(true),
          }}
        >
          <LogLine {...defaultProps} />
        </LogListContext.Provider>
      );
      expect(screen.getByPlaceholderText('Search field names and values')).toBeInTheDocument();
    });
  });
});

describe('getGridTemplateColumns', () => {
  test('Gets the template columns for the default visualization mode', () => {
    expect(
      getGridTemplateColumns(
        [
          {
            field: 'timestamp',
            width: 23,
          },
          {
            field: 'level',
            width: 4,
          },
        ],
        []
      )
    ).toBe('23px 4px 1fr');
  });

  test('Gets the template columns when displayed fields are used', () => {
    expect(
      getGridTemplateColumns(
        [
          {
            field: 'timestamp',
            width: 23,
          },
          {
            field: 'level',
            width: 4,
          },
        ],
        ['field']
      )
    ).toBe('23px 4px');
  });

  test('Gets the template columns when displayed fields are used', () => {
    expect(
      getGridTemplateColumns(
        [
          {
            field: 'timestamp',
            width: 23,
          },
          {
            field: 'level',
            width: 4,
          },
          {
            field: 'field',
            width: 4,
          },
        ],
        ['field']
      )
    ).toBe('23px 4px 4px');
  });

  test('Gets the template columns when displayed fields are used', () => {
    expect(
      getGridTemplateColumns(
        [
          {
            field: 'timestamp',
            width: 23,
          },
          {
            field: 'level',
            width: 4,
          },
          {
            field: 'field',
            width: 4,
          },
          {
            field: LOG_LINE_BODY_FIELD_NAME,
            width: 20,
          },
        ],
        ['field']
      )
    ).toBe('23px 4px 4px 20px');
  });
});
