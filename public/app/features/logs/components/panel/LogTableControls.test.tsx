import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LogsSortOrder } from '@grafana/data';
import { type Options } from 'app/plugins/panel/logstable/options/types';

import { DownloadFormat, downloadLogs } from '../../utils';

import { LogTableControls } from './LogTableControls';

const DOWNLOAD_LOGS_LABEL_COPY = 'Download logs';

const defaultOptions: Options = {
  wrapText: false,
  frameIndex: 0,
  showHeader: true,
};

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
          options={defaultOptions}
          onOptionsChange={jest.fn()}
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
        options={defaultOptions}
        onOptionsChange={jest.fn()}
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
          options={defaultOptions}
          onOptionsChange={jest.fn()}
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
    { wrapText: false as const, tooltip: 'Enable text wrapping', nextWrapText: true },
    { wrapText: true as const, tooltip: 'Disable text wrapping', nextWrapText: false },
  ])(
    'should toggle line wrapping via onOptionsChange when wrapText is $wrapText',
    async ({ wrapText, tooltip, nextWrapText }) => {
      const options: Options = { ...defaultOptions, wrapText };
      const onOptionsChange = jest.fn();
      render(
        <LogTableControls
          logOptionsStorageKey={''}
          controlsExpanded={false}
          setControlsExpanded={jest.fn()}
          sortOrder={LogsSortOrder.Ascending}
          setSortOrder={jest.fn()}
          downloadLogs={jest.fn()}
          options={options}
          onOptionsChange={onOptionsChange}
        />
      );

      const wrapButton = screen.getByLabelText(tooltip);
      expect(wrapButton).toHaveAttribute('aria-pressed', wrapText ? 'true' : 'false');

      await userEvent.click(wrapButton);

      expect(onOptionsChange).toHaveBeenCalledTimes(1);
      expect(onOptionsChange).toHaveBeenCalledWith({ ...options, wrapText: nextWrapText });
    }
  );

  test.each([
    ['txt', DownloadFormat.Text],
    ['json', DownloadFormat.Json],
    ['csv', DownloadFormat.CSV],
  ])('Allows to download logs', async (label: string, format: DownloadFormat) => {
    jest.mocked(downloadLogs).mockClear();
    render(
      <LogTableControls
        logOptionsStorageKey={''}
        controlsExpanded={false}
        setControlsExpanded={jest.fn()}
        sortOrder={LogsSortOrder.Ascending}
        setSortOrder={jest.fn()}
        downloadLogs={downloadLogs as unknown as (format: DownloadFormat) => void}
        options={defaultOptions}
        onOptionsChange={jest.fn()}
      />
    );
    await userEvent.click(screen.getByLabelText(DOWNLOAD_LOGS_LABEL_COPY));
    await userEvent.click(await screen.findByText(label));
    expect(downloadLogs).toHaveBeenCalledTimes(1);
    expect(downloadLogs).toHaveBeenCalledWith(format);
  });
});
