import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LogsSortOrder } from '@grafana/data';

import { DownloadFormat, downloadLogs } from '../../utils';

import { LogTableControls } from './LogTableControls';

const DOWNLOAD_LOGS_LABEL_COPY = 'Download logs';

jest.mock('../../utils', () => ({
  ...jest.requireActual('../../utils'),
  downloadLogs: jest.fn(),
}));

describe('LogTableControls', () => {
  it.each([LogsSortOrder.Descending, LogsSortOrder.Ascending])('should render descending', (sortOrder) => {
    render(
      <LogTableControls
        logOptionsStorageKey={''}
        controlsExpanded={false}
        setControlsExpanded={jest.fn()}
        sortOrder={sortOrder}
        setSortOrder={jest.fn()}
        downloadLogs={jest.fn()}
      />
    );
    expect(screen.getByLabelText('Expand')).toBeInTheDocument();
    expect(
      screen.getByLabelText(`Sorted by ${sortOrder === LogsSortOrder.Ascending ? 'oldest' : 'newest'}`, {
        exact: false,
      })
    ).toBeInTheDocument();
  });

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

  test.each([
    ['txt', 'text'],
    ['json', 'json'],
    ['csv', 'csv'],
  ])('Allows to download logs', async (label: string, format: string) => {
    jest.mocked(downloadLogs).mockClear();
    const setSortOrder = jest.fn();
    render(
      <LogTableControls
        logOptionsStorageKey={''}
        controlsExpanded={false}
        setControlsExpanded={jest.fn()}
        sortOrder={LogsSortOrder.Ascending}
        setSortOrder={setSortOrder}
        downloadLogs={downloadLogs as unknown as (format: DownloadFormat) => void}
      />
    );
    await userEvent.click(screen.getByLabelText(DOWNLOAD_LOGS_LABEL_COPY));
    await userEvent.click(await screen.findByText(label));
    expect(downloadLogs).toHaveBeenCalledTimes(1);
    expect(downloadLogs).toHaveBeenCalledWith(format);
  });
});
