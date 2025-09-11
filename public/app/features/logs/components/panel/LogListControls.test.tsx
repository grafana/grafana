import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CoreApp, EventBusSrv, LogLevel, LogsDedupStrategy, LogsSortOrder } from '@grafana/data';
import { config } from '@grafana/runtime';

import { downloadLogs } from '../../utils';
import { createLogLine, createLogRow } from '../mocks/logRow';

import { LogListFontSize } from './LogList';
import { LogListContextProvider } from './LogListContext';
import { LogListControls } from './LogListControls';
import { ScrollToLogsEvent } from './virtualization';

const FILTER_LEVELS_LABEL_COPY = 'Filter levels';
const SCROLL_BOTTOM_LABEL_COPY = 'Scroll to bottom';
const SCROLL_TOP_LABEL_COPY = 'Scroll to top';
const OLDEST_LOGS_LABEL_COPY = 'Oldest logs first';
const DEDUPE_LABEL_COPY = 'Deduplication';
const SHOW_TIMESTAMP_LABEL_COPY = 'Show timestamps';
const WRAP_LINES_LABEL_COPY = 'Wrap lines';
const WRAP_JSON_TOOLTIP_COPY = 'Enable line wrapping and prettify JSON';
const WRAP_JSON_LABEL_COPY = 'Wrap JSON';
const WRAP_DISABLE_LABEL_COPY = 'Disable line wrapping';
const ENABLE_HIGHLIGHTING_LABEL_COPY = 'Enable highlighting';
const EXPANDED_LABEL_COPY = 'Expanded';
const COLLAPSED_LABEL_COPY = 'Collapsed';
const SHOW_UNIQUE_LABELS_LABEL_COPY = 'Show unique labels';
const HIDE_UNIQUE_LABELS_LABEL_COPY = 'Hide unique labels';
const EXPAND_JSON_LOGS_LABEL_COPY = 'Expand JSON logs';
const COLLAPSE_JSON_LOGS_LABEL_COPY = 'Collapse JSON logs';
const ESCAPE_NEWLINES_TOOLTIP_COPY = 'Fix incorrectly escaped newline and tab sequences in log lines';
const REMOVE_ESCAPE_NEWLINES_LABEL_COPY = 'Remove escaping';
const TIMESTAMP_LABEL_COPY = 'Log timestamps';
const TIMESTAMP_HIDE_LABEL_COPY = 'Hide timestamps';
const FONT_SIZE_LARGE_LABEL_COPY = 'Large font';
const FONT_SIZE_LARGE_TOOLTIP_COPY = 'Set large font';
const FONT_SIZE_SMALL_LABEL_COPY = 'Small font';
const FONT_SIZE_SMALL_TOOLTIP_COPY = 'Set small font';
const DOWNLOAD_LOGS_LABEL_COPY = 'Download logs';

const OLDEST_LOGS_LABEL_REGEX = /oldest logs first/;

jest.mock('../../utils', () => ({
  ...jest.requireActual('../../utils'),
  downloadLogs: jest.fn(),
}));

jest.mock('@grafana/assistant', () => {
  return {
    ...jest.requireActual('@grafana/assistant'),
    useAssistant: jest.fn().mockReturnValue([true, jest.fn()]),
  };
});

const fontSize: LogListFontSize = 'default';
const contextProps = {
  app: CoreApp.Unknown,
  containerElement: document.createElement('div'),
  dedupStrategy: LogsDedupStrategy.exact,
  displayedFields: [],
  enableLogDetails: false,
  fontSize,
  logs: [],
  showControls: true,
  showTime: false,
  sortOrder: LogsSortOrder.Ascending,
  syntaxHighlighting: false,
  wrapLogMessage: false,
  isAssistantAvailable: false,
  openAssistantByLog: () => {},
};

describe('LogListControls', () => {
  test('Renders without errors', () => {
    render(
      <LogListContextProvider {...contextProps}>
        <LogListControls eventBus={new EventBusSrv()} />
      </LogListContextProvider>
    );
    expect(screen.getByLabelText(SCROLL_BOTTOM_LABEL_COPY)).toBeInTheDocument();
    expect(screen.getByLabelText(OLDEST_LOGS_LABEL_REGEX)).toBeInTheDocument();
    expect(screen.getByLabelText(DEDUPE_LABEL_COPY)).toBeInTheDocument();
    expect(screen.getByLabelText(FILTER_LEVELS_LABEL_COPY)).toBeInTheDocument();
    expect(screen.getByLabelText(SHOW_TIMESTAMP_LABEL_COPY)).toBeInTheDocument();
    expect(screen.getByLabelText(WRAP_LINES_LABEL_COPY)).toBeInTheDocument();
    expect(screen.getByLabelText(ENABLE_HIGHLIGHTING_LABEL_COPY)).toBeInTheDocument();
    expect(screen.getByLabelText(SCROLL_TOP_LABEL_COPY)).toBeInTheDocument();
    expect(screen.queryByLabelText(SHOW_UNIQUE_LABELS_LABEL_COPY)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(EXPAND_JSON_LOGS_LABEL_COPY)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(ESCAPE_NEWLINES_TOOLTIP_COPY)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(REMOVE_ESCAPE_NEWLINES_LABEL_COPY)).not.toBeInTheDocument();
  });

  test('Renders legacy controls', () => {
    render(
      <LogListContextProvider {...contextProps} app={CoreApp.Explore} showUniqueLabels={false} prettifyJSON={false}>
        <LogListControls eventBus={new EventBusSrv()} />
      </LogListContextProvider>
    );
    expect(screen.getByLabelText(SHOW_UNIQUE_LABELS_LABEL_COPY)).toBeInTheDocument();
    expect(screen.getByLabelText(EXPAND_JSON_LOGS_LABEL_COPY)).toBeInTheDocument();
  });

  test.each([CoreApp.Dashboard, CoreApp.PanelEditor, CoreApp.PanelViewer])(
    'Renders a subset of options for dashboards',
    (app: CoreApp) => {
      render(
        <LogListContextProvider {...contextProps} app={app}>
          <LogListControls eventBus={new EventBusSrv()} />
        </LogListContextProvider>
      );
      expect(screen.getByLabelText(SCROLL_BOTTOM_LABEL_COPY)).toBeInTheDocument();
      expect(screen.getByLabelText(SCROLL_TOP_LABEL_COPY)).toBeInTheDocument();
      expect(screen.getByLabelText(FILTER_LEVELS_LABEL_COPY)).toBeInTheDocument();
      expect(screen.queryByLabelText(OLDEST_LOGS_LABEL_REGEX)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(DEDUPE_LABEL_COPY)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(SHOW_TIMESTAMP_LABEL_COPY)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(WRAP_LINES_LABEL_COPY)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(ENABLE_HIGHLIGHTING_LABEL_COPY)).not.toBeInTheDocument();
    }
  );

  test('Renders a subset of options for plugins', () => {
    render(
      <LogListContextProvider {...contextProps} app={CoreApp.Unknown}>
        <LogListControls eventBus={new EventBusSrv()} />
      </LogListContextProvider>
    );
    expect(screen.getByLabelText(SCROLL_BOTTOM_LABEL_COPY)).toBeInTheDocument();
    expect(screen.getByLabelText(OLDEST_LOGS_LABEL_REGEX)).toBeInTheDocument();
    expect(screen.getByLabelText(DEDUPE_LABEL_COPY)).toBeInTheDocument();
    expect(screen.getByLabelText(FILTER_LEVELS_LABEL_COPY)).toBeInTheDocument();
    expect(screen.getByLabelText(SHOW_TIMESTAMP_LABEL_COPY)).toBeInTheDocument();
    expect(screen.getByLabelText(WRAP_LINES_LABEL_COPY)).toBeInTheDocument();
    expect(screen.getByLabelText(ENABLE_HIGHLIGHTING_LABEL_COPY)).toBeInTheDocument();
    expect(screen.getByLabelText(SCROLL_TOP_LABEL_COPY)).toBeInTheDocument();
    expect(screen.queryByLabelText(SHOW_UNIQUE_LABELS_LABEL_COPY)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(EXPAND_JSON_LOGS_LABEL_COPY)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(ESCAPE_NEWLINES_TOOLTIP_COPY)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(REMOVE_ESCAPE_NEWLINES_LABEL_COPY)).not.toBeInTheDocument();
  });

  test('Allows to scroll', async () => {
    const eventBus = new EventBusSrv();
    jest.spyOn(eventBus, 'publish');
    render(
      <LogListContextProvider {...contextProps}>
        <LogListControls eventBus={eventBus} />
      </LogListContextProvider>
    );
    await userEvent.click(screen.getByLabelText(SCROLL_BOTTOM_LABEL_COPY));
    await userEvent.click(screen.getByLabelText(SCROLL_TOP_LABEL_COPY));
    expect(eventBus.publish).toHaveBeenCalledTimes(2);
    expect(eventBus.publish).toHaveBeenCalledWith(
      new ScrollToLogsEvent({
        scrollTo: 'bottom',
      })
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      new ScrollToLogsEvent({
        scrollTo: 'top',
      })
    );
  });

  test('Expands options', async () => {
    render(
      <LogListContextProvider {...contextProps} sortOrder={LogsSortOrder.Ascending}>
        <LogListControls eventBus={new EventBusSrv()} />
      </LogListContextProvider>
    );
    // Initial state should be collapsed
    expect(screen.getByLabelText(COLLAPSED_LABEL_COPY)).toBeVisible();
    // Expanded label should not be visible
    expect(screen.queryByText(EXPANDED_LABEL_COPY)).not.toBeInTheDocument();
    // Expand options
    await userEvent.click(screen.getByLabelText(COLLAPSED_LABEL_COPY));
    // Verify that the label (state) is not collapsed
    expect(screen.queryByLabelText(COLLAPSED_LABEL_COPY)).not.toBeInTheDocument();
    expect(screen.getByLabelText(EXPANDED_LABEL_COPY)).toBeVisible();
    // Verify that the option label text is visible
    expect(screen.getByText(EXPANDED_LABEL_COPY)).toBeVisible();
    expect(screen.getByText(SCROLL_BOTTOM_LABEL_COPY)).toBeVisible();
    expect(screen.getByText(OLDEST_LOGS_LABEL_COPY)).toBeVisible();
    expect(screen.getByText(DEDUPE_LABEL_COPY)).toBeVisible();
    expect(screen.getByText(SCROLL_TOP_LABEL_COPY)).toBeVisible();
  });

  test('Controls sort order', async () => {
    const onLogOptionsChange = jest.fn();
    render(
      <LogListContextProvider
        {...contextProps}
        sortOrder={LogsSortOrder.Ascending}
        onLogOptionsChange={onLogOptionsChange}
      >
        <LogListControls eventBus={new EventBusSrv()} />
      </LogListContextProvider>
    );
    await userEvent.click(screen.getByLabelText(OLDEST_LOGS_LABEL_REGEX));
    expect(onLogOptionsChange).toHaveBeenCalledTimes(1);
    expect(onLogOptionsChange).toHaveBeenCalledWith('sortOrder', LogsSortOrder.Descending);
  });

  test('Controls deduplication', async () => {
    const onLogOptionsChange = jest.fn();
    render(
      <LogListContextProvider {...contextProps} onLogOptionsChange={onLogOptionsChange}>
        <LogListControls eventBus={new EventBusSrv()} />
      </LogListContextProvider>
    );
    await userEvent.click(screen.getByLabelText(DEDUPE_LABEL_COPY));
    await userEvent.click(screen.getByText('Numbers'));
    expect(onLogOptionsChange).toHaveBeenCalledTimes(1);
    expect(onLogOptionsChange).toHaveBeenCalledWith('dedupStrategy', LogsDedupStrategy.numbers);
  });

  test('Sets level filters', async () => {
    const onLogOptionsChange = jest.fn();
    render(
      <LogListContextProvider {...contextProps} onLogOptionsChange={onLogOptionsChange}>
        <LogListControls eventBus={new EventBusSrv()} />
      </LogListContextProvider>
    );
    await userEvent.click(screen.getByLabelText(FILTER_LEVELS_LABEL_COPY));
    expect(await screen.findByText('All levels')).toBeVisible();
    expect(screen.getByText('Info')).toBeVisible();
    expect(screen.getByText('Debug')).toBeVisible();
    expect(screen.getByText('Trace')).toBeVisible();
    expect(screen.getByText('Warning')).toBeVisible();
    expect(screen.getByText('Error')).toBeVisible();
    expect(screen.getByText('Critical')).toBeVisible();
    await userEvent.click(screen.getByText('Error'));
    expect(onLogOptionsChange).toHaveBeenCalledWith('filterLevels', ['error']);
  });

  test('Controls timestamp visibility', async () => {
    const onLogOptionsChange = jest.fn();
    render(
      <LogListContextProvider {...contextProps} showTime={false} onLogOptionsChange={onLogOptionsChange}>
        <LogListControls eventBus={new EventBusSrv()} />
      </LogListContextProvider>
    );
    await userEvent.click(screen.getByLabelText(SHOW_TIMESTAMP_LABEL_COPY));
    expect(onLogOptionsChange).toHaveBeenCalledTimes(1);
    expect(onLogOptionsChange).toHaveBeenCalledWith('showTime', true);
  });

  test('Controls line wrapping', async () => {
    const onLogOptionsChange = jest.fn();
    render(
      <LogListContextProvider {...contextProps} wrapLogMessage={false} onLogOptionsChange={onLogOptionsChange}>
        <LogListControls eventBus={new EventBusSrv()} />
      </LogListContextProvider>
    );
    await userEvent.click(screen.getByLabelText(WRAP_LINES_LABEL_COPY));
    expect(onLogOptionsChange).toHaveBeenCalledTimes(1);
    expect(onLogOptionsChange).toHaveBeenCalledWith('wrapLogMessage', true);
  });

  test('Controls line wrapping and prettify JSON', async () => {
    const originalFlagState = config.featureToggles.newLogsPanel;
    config.featureToggles.newLogsPanel = true;

    const onLogOptionsChange = jest.fn();
    render(
      <LogListContextProvider
        {...contextProps}
        wrapLogMessage={false}
        onLogOptionsChange={onLogOptionsChange}
        prettifyJSON={false}
      >
        <LogListControls eventBus={new EventBusSrv()} />
      </LogListContextProvider>
    );

    await userEvent.click(screen.getByLabelText('Wrap disabled'));
    await userEvent.click(screen.getByText('Enable line wrapping'));

    expect(onLogOptionsChange).toHaveBeenCalledTimes(2);
    expect(onLogOptionsChange).toHaveBeenCalledWith('wrapLogMessage', true);
    expect(onLogOptionsChange).toHaveBeenCalledWith('prettifyJSON', false);

    await userEvent.click(screen.getByLabelText(WRAP_LINES_LABEL_COPY));
    await userEvent.click(screen.getByText(WRAP_JSON_TOOLTIP_COPY));

    expect(onLogOptionsChange).toHaveBeenCalledTimes(4);
    expect(onLogOptionsChange).toHaveBeenCalledWith('prettifyJSON', true);

    await userEvent.click(screen.getByLabelText(WRAP_JSON_LABEL_COPY));
    await userEvent.click(screen.getByText(WRAP_DISABLE_LABEL_COPY));

    expect(onLogOptionsChange).toHaveBeenCalledWith('wrapLogMessage', false);
    expect(onLogOptionsChange).toHaveBeenCalledWith('prettifyJSON', false);

    expect(onLogOptionsChange).toHaveBeenCalledTimes(6);

    config.featureToggles.newLogsPanel = originalFlagState;
  });

  test('Controls line wrapping and prettify JSON', async () => {
    const originalFlagState = config.featureToggles.newLogsPanel;
    config.featureToggles.newLogsPanel = true;

    const onLogOptionsChange = jest.fn();
    render(
      <LogListContextProvider {...contextProps} showTime={false} onLogOptionsChange={onLogOptionsChange}>
        <LogListControls eventBus={new EventBusSrv()} />
      </LogListContextProvider>
    );

    await userEvent.click(screen.getByLabelText(TIMESTAMP_LABEL_COPY));
    await userEvent.click(screen.getByText('Show millisecond timestamps'));

    expect(onLogOptionsChange).toHaveBeenCalledTimes(1);
    expect(onLogOptionsChange).toHaveBeenCalledWith('showTime', true);

    await userEvent.click(screen.getByLabelText(TIMESTAMP_LABEL_COPY));
    await userEvent.click(screen.getByText('Show nanosecond timestamps'));

    expect(onLogOptionsChange).toHaveBeenCalledTimes(2);

    await userEvent.click(screen.getByLabelText(TIMESTAMP_LABEL_COPY));
    await userEvent.click(screen.getByText(TIMESTAMP_HIDE_LABEL_COPY));

    expect(onLogOptionsChange).toHaveBeenCalledTimes(3);
    expect(onLogOptionsChange).toHaveBeenCalledWith('showTime', false);

    config.featureToggles.newLogsPanel = originalFlagState;
  });

  test('Controls syntax highlighting', async () => {
    const onLogOptionsChange = jest.fn();
    render(
      <LogListContextProvider {...contextProps} syntaxHighlighting={false} onLogOptionsChange={onLogOptionsChange}>
        <LogListControls eventBus={new EventBusSrv()} />
      </LogListContextProvider>
    );
    await userEvent.click(screen.getByLabelText(ENABLE_HIGHLIGHTING_LABEL_COPY));
    expect(onLogOptionsChange).toHaveBeenCalledTimes(1);
    expect(onLogOptionsChange).toHaveBeenCalledWith('syntaxHighlighting', true);
  });

  test('Controls unique labels', async () => {
    const { rerender } = render(
      <LogListContextProvider {...contextProps} app={CoreApp.Explore} showUniqueLabels={false}>
        <LogListControls eventBus={new EventBusSrv()} />
      </LogListContextProvider>
    );
    await userEvent.click(screen.getByLabelText(SHOW_UNIQUE_LABELS_LABEL_COPY));
    rerender(
      <LogListContextProvider {...contextProps} app={CoreApp.Explore} showUniqueLabels={false}>
        <LogListControls eventBus={new EventBusSrv()} />
      </LogListContextProvider>
    );
    expect(screen.getByLabelText(HIDE_UNIQUE_LABELS_LABEL_COPY));
  });

  test('Controls Expand JSON logs', async () => {
    const { rerender } = render(
      <LogListContextProvider {...contextProps} prettifyJSON={false}>
        <LogListControls eventBus={new EventBusSrv()} />
      </LogListContextProvider>
    );
    await userEvent.click(screen.getByLabelText(EXPAND_JSON_LOGS_LABEL_COPY));
    rerender(
      <LogListContextProvider {...contextProps} showUniqueLabels={false}>
        <LogListControls eventBus={new EventBusSrv()} />
      </LogListContextProvider>
    );
    expect(screen.getByLabelText(COLLAPSE_JSON_LOGS_LABEL_COPY));
  });

  test('Controls font size', async () => {
    const originalValue = config.featureToggles.newLogsPanel;
    config.featureToggles.newLogsPanel = true;

    render(
      <LogListContextProvider {...contextProps}>
        <LogListControls eventBus={new EventBusSrv()} />
      </LogListContextProvider>
    );
    await userEvent.click(screen.getByLabelText(FONT_SIZE_LARGE_LABEL_COPY));
    await screen.findByLabelText(FONT_SIZE_LARGE_TOOLTIP_COPY);

    await userEvent.click(screen.getByLabelText(FONT_SIZE_SMALL_LABEL_COPY));
    await screen.findByLabelText(FONT_SIZE_SMALL_TOOLTIP_COPY);

    config.featureToggles.newLogsPanel = originalValue;
  });

  test.each([
    ['txt', 'text'],
    ['json', 'json'],
    ['csv', 'csv'],
  ])('Allows to download logs', async (label: string, format: string) => {
    jest.mocked(downloadLogs).mockClear();
    render(
      <LogListContextProvider {...contextProps}>
        <LogListControls eventBus={new EventBusSrv()} />
      </LogListContextProvider>
    );
    await userEvent.click(screen.getByLabelText(DOWNLOAD_LOGS_LABEL_COPY));
    await userEvent.click(await screen.findByText(label));
    expect(downloadLogs).toHaveBeenCalledTimes(1);
    expect(downloadLogs).toHaveBeenCalledWith(format, [], undefined);
  });

  test('Allows to download logs filtered logs', async () => {
    jest.mocked(downloadLogs).mockClear();
    const log1 = createLogRow({ logLevel: LogLevel.error });
    const log2 = createLogRow({ logLevel: LogLevel.warning });
    const logs = [log1, log2];
    const filteredLogs = [log1];

    render(
      <LogListContextProvider {...contextProps} logs={logs} filterLevels={[LogLevel.error]}>
        <LogListControls eventBus={new EventBusSrv()} />
      </LogListContextProvider>
    );
    await userEvent.click(screen.getByLabelText(DOWNLOAD_LOGS_LABEL_COPY));
    await userEvent.click(await screen.findByText('txt'));
    expect(downloadLogs).toHaveBeenCalledWith('text', filteredLogs, undefined);
  });

  test('Controls new lines', async () => {
    const log = createLogLine({ entry: 'the\\r\\nentry', hasUnescapedContent: true });
    const { rerender } = render(
      <LogListContextProvider {...contextProps} logs={[log]}>
        <LogListControls eventBus={new EventBusSrv()} />
      </LogListContextProvider>
    );
    await userEvent.click(screen.getByLabelText(ESCAPE_NEWLINES_TOOLTIP_COPY));
    rerender(
      <LogListContextProvider {...contextProps} logs={[log]}>
        <LogListControls eventBus={new EventBusSrv()} />
      </LogListContextProvider>
    );
    await userEvent.click(screen.getByLabelText(REMOVE_ESCAPE_NEWLINES_LABEL_COPY));
  });
});
