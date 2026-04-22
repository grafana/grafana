import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CoreApp, EventBusSrv, LogsSortOrder } from '@grafana/data';

import { DownloadFormat, downloadLogs } from '../../utils';

import { LogTableControls } from './LogTableControls';
import { PanelContextProvider } from '@grafana/ui';

const DOWNLOAD_LOGS_LABEL_COPY = 'Download logs';

jest.mock('../../utils', () => ({
  ...jest.requireActual('../../utils'),
  downloadLogs: jest.fn(),
}));

describe('LogTableControls', () => {
  it.each([LogsSortOrder.Descending, LogsSortOrder.Ascending])(
    'should render expand and sort controls for sort order %s',
    (sortOrder) => {
      render(
        <LogTableControls
          logOptionsStorageKey={''}
          controlsExpanded={false}
          setControlsExpanded={jest.fn()}
          sortOrder={sortOrder}
          setSortOrder={jest.fn()}
          downloadLogs={jest.fn()}
          wrapText={false}
          onWrapTextClick={jest.fn()}
        />
      );
      expect(screen.getByLabelText('Expand')).toBeInTheDocument();
      expect(screen.getByLabelText('Enable text wrapping')).toBeInTheDocument();
      expect(
        screen.getByLabelText(`Sorted by ${sortOrder === LogsSortOrder.Ascending ? 'oldest' : 'newest'}`, {
          exact: false,
        })
      ).toBeInTheDocument();
    }
  );

  it.each([true, false])('should call setControlsExpanded', async (expanded) => {
    const setControlsExpanded = jest.fn();
    const expandedText = expanded ? 'Collapse' : 'Expand';

    render(
      <LogTableControls
        logOptionsStorageKey={''}
        controlsExpanded={expanded}
        setControlsExpanded={setControlsExpanded}
        sortOrder={LogsSortOrder.Ascending}
        setSortOrder={jest.fn()}
        downloadLogs={jest.fn()}
        wrapText={false}
        onWrapTextClick={jest.fn()}
      />
    );
    expect(screen.getByLabelText(expandedText)).toBeInTheDocument();
    expect(setControlsExpanded).toBeCalledTimes(0);
    await userEvent.click(screen.getByLabelText(expandedText));
    expect(setControlsExpanded).toBeCalledTimes(1);
    expect(setControlsExpanded).toBeCalledWith(!expanded);
  });

  it.each([LogsSortOrder.Ascending, LogsSortOrder.Descending])(
    'should call setSortOrder',
    async (sortOrder: LogsSortOrder) => {
      const setSortOrder = jest.fn();
      const sortOrderText = `Sorted by ${sortOrder === LogsSortOrder.Ascending ? 'oldest' : 'newest'}`;
      render(
        <LogTableControls
          logOptionsStorageKey={''}
          controlsExpanded={false}
          setControlsExpanded={jest.fn()}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          downloadLogs={jest.fn()}
          wrapText={false}
          onWrapTextClick={jest.fn()}
        />
      );

      expect(screen.getByLabelText(/sorted by/i)).toBeInTheDocument();
      expect(setSortOrder).toBeCalledTimes(0);
      await userEvent.click(screen.getByLabelText(sortOrderText, { exact: false }));
      expect(setSortOrder).toBeCalledTimes(1);
      expect(setSortOrder).toBeCalledWith(
        sortOrder === LogsSortOrder.Ascending ? LogsSortOrder.Descending : LogsSortOrder.Ascending
      );
    }
  );

  it.each([
    { wrapText: false as const, tooltip: 'Enable text wrapping' },
    { wrapText: true as const, tooltip: 'Disable text wrapping' },
  ])('should call onWrapTextClick when toggling wrap from wrapText=$wrapText', async ({ wrapText, tooltip }) => {
    const onWrapTextClick = jest.fn();
    render(
      <LogTableControls
        logOptionsStorageKey={''}
        controlsExpanded={false}
        setControlsExpanded={jest.fn()}
        sortOrder={LogsSortOrder.Ascending}
        setSortOrder={jest.fn()}
        downloadLogs={jest.fn()}
        wrapText={wrapText}
        onWrapTextClick={onWrapTextClick}
      />
    );

    const wrapButton = screen.getByLabelText(tooltip);
    expect(wrapButton).toHaveAttribute('aria-pressed', wrapText ? 'true' : 'false');

    await userEvent.click(wrapButton);

    expect(onWrapTextClick).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['txt', DownloadFormat.Text],
    ['json', DownloadFormat.Json],
    ['csv', DownloadFormat.CSV],
  ])('Allows to download logs in plugins and Explore', async (label: string, format: DownloadFormat) => {
    jest.mocked(downloadLogs).mockClear();
    render(
      <PanelContextProvider
        value={{
          app: CoreApp.Explore,
          eventsScope: 'test',
          eventBus: new EventBusSrv(),
        }}
      >
        <LogTableControls
          logOptionsStorageKey={''}
          controlsExpanded={false}
          setControlsExpanded={jest.fn()}
          sortOrder={LogsSortOrder.Ascending}
          setSortOrder={jest.fn()}
          downloadLogs={downloadLogs as unknown as (f: DownloadFormat) => void}
          wrapText={false}
          onWrapTextClick={jest.fn()}
        />
      </PanelContextProvider>
    );
    await userEvent.click(screen.getByLabelText(DOWNLOAD_LOGS_LABEL_COPY));
    await userEvent.click(await screen.findByText(label));
    expect(downloadLogs).toHaveBeenCalledTimes(1);
    expect(downloadLogs).toHaveBeenCalledWith(format);
  });

  test.each([
    ['txt', DownloadFormat.Text],
    ['json', DownloadFormat.Json],
    ['csv', DownloadFormat.CSV],
  ])('Allows to download logs in Dashboards when enabled', async (label: string, format: DownloadFormat) => {
    jest.mocked(downloadLogs).mockClear();
    render(
      <PanelContextProvider
        value={{
          app: CoreApp.Dashboard,
          eventsScope: 'test',
          eventBus: new EventBusSrv(),
        }}
      >
        <LogTableControls
          allowDownload
          logOptionsStorageKey={''}
          controlsExpanded={false}
          setControlsExpanded={jest.fn()}
          sortOrder={LogsSortOrder.Ascending}
          setSortOrder={jest.fn()}
          downloadLogs={downloadLogs as unknown as (f: DownloadFormat) => void}
          wrapText={false}
          onWrapTextClick={jest.fn()}
        />
      </PanelContextProvider>
    );
    await userEvent.click(screen.getByLabelText(DOWNLOAD_LOGS_LABEL_COPY));
    await userEvent.click(await screen.findByText(label));
    expect(downloadLogs).toHaveBeenCalledTimes(1);
    expect(downloadLogs).toHaveBeenCalledWith(format);
  });

  it('Does not allow to download when disabled', async () => {
    render(
      <PanelContextProvider
        value={{
          app: CoreApp.Dashboard,
          eventsScope: 'test',
          eventBus: new EventBusSrv(),
        }}
      >
        <LogTableControls
          logOptionsStorageKey={''}
          controlsExpanded={false}
          setControlsExpanded={jest.fn()}
          sortOrder={LogsSortOrder.Ascending}
          setSortOrder={jest.fn()}
          downloadLogs={downloadLogs as unknown as (f: DownloadFormat) => void}
          wrapText={false}
          onWrapTextClick={jest.fn()}
        />
      </PanelContextProvider>
    );
    expect(screen.queryByLabelText(DOWNLOAD_LOGS_LABEL_COPY)).not.toBeInTheDocument();
  });
});
