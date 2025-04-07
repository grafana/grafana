import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CoreApp, EventBusSrv, LogLevel, LogsDedupStrategy, LogsSortOrder } from '@grafana/data';

import { downloadLogs } from '../../utils';
import { createLogRow } from '../__mocks__/logRow';

import { LogListContextProvider } from './LogListContext';
import { LogListControls } from './LogListControls';
import { ScrollToLogsEvent } from './virtualization';

jest.mock('../../utils');

const contextProps = {
  app: CoreApp.Unknown,
  dedupStrategy: LogsDedupStrategy.exact,
  displayedFields: [],
  logs: [],
  showControls: true,
  showTime: false,
  sortOrder: LogsSortOrder.Ascending,
  syntaxHighlighting: false,
  wrapLogMessage: false,
};

describe('LogListControls', () => {
  test('Renders without errors', () => {
    render(
      <LogListContextProvider {...contextProps}>
        <LogListControls eventBus={new EventBusSrv()} />
      </LogListContextProvider>
    );
    expect(screen.getByLabelText('Scroll to bottom')).toBeInTheDocument();
    expect(screen.getByLabelText('Oldest logs first')).toBeInTheDocument();
    expect(screen.getByLabelText('Deduplication')).toBeInTheDocument();
    expect(screen.getByLabelText('Display levels')).toBeInTheDocument();
    expect(screen.getByLabelText('Show timestamps')).toBeInTheDocument();
    expect(screen.getByLabelText('Wrap lines')).toBeInTheDocument();
    expect(screen.getByLabelText('Enable highlighting')).toBeInTheDocument();
    expect(screen.getByLabelText('Scroll to top')).toBeInTheDocument();
    expect(screen.queryByLabelText('Show unique labels')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Expand JSON logs')).not.toBeInTheDocument();
  });

  test('Renders legacy controls', () => {
    render(
      <LogListContextProvider {...contextProps} showUniqueLabels={false} prettifyJSON={false}>
        <LogListControls eventBus={new EventBusSrv()} />
      </LogListContextProvider>
    );
    expect(screen.getByLabelText('Show unique labels')).toBeInTheDocument();
    expect(screen.getByLabelText('Expand JSON logs')).toBeInTheDocument();
  });

  test.each([CoreApp.Dashboard, CoreApp.PanelEditor, CoreApp.PanelViewer])(
    'Renders a subset of options for dashboards',
    (app: CoreApp) => {
      render(
        <LogListContextProvider {...contextProps} app={app}>
          <LogListControls eventBus={new EventBusSrv()} />
        </LogListContextProvider>
      );
      expect(screen.getByLabelText('Scroll to bottom')).toBeInTheDocument();
      expect(screen.getByLabelText('Scroll to top')).toBeInTheDocument();
      expect(screen.getByLabelText('Display levels')).toBeInTheDocument();
      expect(screen.queryByLabelText('Oldest logs first')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Deduplication')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Show timestamps')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Wrap lines')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Enable highlighting')).not.toBeInTheDocument();
    }
  );

  test('Allows to scroll', async () => {
    const eventBus = new EventBusSrv();
    jest.spyOn(eventBus, 'publish');
    render(
      <LogListContextProvider {...contextProps}>
        <LogListControls eventBus={eventBus} />
      </LogListContextProvider>
    );
    await userEvent.click(screen.getByLabelText('Scroll to bottom'));
    await userEvent.click(screen.getByLabelText('Scroll to top'));
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
    await userEvent.click(screen.getByLabelText('Oldest logs first'));
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
    await userEvent.click(screen.getByLabelText('Deduplication'));
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
    await userEvent.click(screen.getByLabelText('Display levels'));
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
    await userEvent.click(screen.getByLabelText('Show timestamps'));
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
    await userEvent.click(screen.getByLabelText('Wrap lines'));
    expect(onLogOptionsChange).toHaveBeenCalledTimes(1);
    expect(onLogOptionsChange).toHaveBeenCalledWith('wrapLogMessage', true);
  });

  test('Controls syntax highlighting', async () => {
    const onLogOptionsChange = jest.fn();
    render(
      <LogListContextProvider {...contextProps} syntaxHighlighting={false} onLogOptionsChange={onLogOptionsChange}>
        <LogListControls eventBus={new EventBusSrv()} />
      </LogListContextProvider>
    );
    await userEvent.click(screen.getByLabelText('Enable highlighting'));
    expect(onLogOptionsChange).toHaveBeenCalledTimes(1);
    expect(onLogOptionsChange).toHaveBeenCalledWith('syntaxHighlighting', true);
  });

  test('Controls unique labels', async () => {
    const { rerender } = render(
      <LogListContextProvider {...contextProps} showUniqueLabels={false}>
        <LogListControls eventBus={new EventBusSrv()} />
      </LogListContextProvider>
    );
    await userEvent.click(screen.getByLabelText('Show unique labels'));
    rerender(
      <LogListContextProvider {...contextProps} showUniqueLabels={false}>
        <LogListControls eventBus={new EventBusSrv()} />
      </LogListContextProvider>
    );
    expect(screen.getByLabelText('Hide unique labels'));
  });

  test('Controls Expand JSON logs', async () => {
    const { rerender } = render(
      <LogListContextProvider {...contextProps} prettifyJSON={false}>
        <LogListControls eventBus={new EventBusSrv()} />
      </LogListContextProvider>
    );
    await userEvent.click(screen.getByLabelText('Expand JSON logs'));
    rerender(
      <LogListContextProvider {...contextProps} showUniqueLabels={false}>
        <LogListControls eventBus={new EventBusSrv()} />
      </LogListContextProvider>
    );
    expect(screen.getByLabelText('Collapse JSON logs'));
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
    await userEvent.click(screen.getByLabelText('Download logs'));
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
    await userEvent.click(screen.getByLabelText('Download logs'));
    await userEvent.click(await screen.findByText('txt'));
    expect(downloadLogs).toHaveBeenCalledWith('text', filteredLogs, undefined);
  });
});
