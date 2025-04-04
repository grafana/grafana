import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CoreApp, EventBusSrv, LogsDedupStrategy, LogsSortOrder } from '@grafana/data';

import { LogListContextProvider } from './LogListContext';
import { LogListControls } from './LogListControls';
import { ScrollToLogsEvent } from './virtualization';

const contextProps = {
  app: CoreApp.Unknown,
  dedupStrategy: LogsDedupStrategy.exact,
  displayedFields: [],
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
});
