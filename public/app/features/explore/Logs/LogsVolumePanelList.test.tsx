import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataQueryResponse, LoadingState, EventBusSrv, LogRowModel, arrayToDataFrame, DataTopic } from '@grafana/data';
import { createLogLine } from 'app/features/logs/components/mocks/logRow';

import * as logUtils from '../../logs/utils';

import { LogsVolumePanelList } from './LogsVolumePanelList';

jest.mock('../Graph/ExploreGraph', () => {
  const ExploreGraph = () => <span>ExploreGraph</span>;
  return {
    ExploreGraph,
  };
});

function renderPanel(logsVolumeData?: DataQueryResponse, onLoadLogsVolume = () => {}, logs: LogRowModel[] = []) {
  render(
    <LogsVolumePanelList
      absoluteRange={{ from: 0, to: 1 }}
      timeZone="timeZone"
      splitOpen={() => {}}
      width={100}
      onUpdateTimeRange={() => {}}
      logsVolumeData={logsVolumeData}
      onLoadLogsVolume={onLoadLogsVolume}
      onDisplayedSeriesChanged={() => null}
      eventBus={new EventBusSrv()}
      logs={logs}
    />
  );
}

describe('LogsVolumePanelList', () => {
  it('shows loading message', () => {
    renderPanel({ state: LoadingState.Loading, error: undefined, data: [] });
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows short warning message', () => {
    renderPanel({ state: LoadingState.Error, error: { data: { message: 'Test error message' } }, data: [] });
    expect(screen.getByText('Failed to load log volume for this query')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('shows long warning message', async () => {
    // we make a long message
    const messagePart = 'One two three four five six seven eight nine ten.';
    const message = messagePart + ' ' + messagePart + ' ' + messagePart;

    renderPanel({ state: LoadingState.Error, error: { data: { message } }, data: [] });
    expect(screen.getByText('Failed to load log volume for this query')).toBeInTheDocument();
    expect(screen.queryByText(message)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show details' }));
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('has a custom message for timeout errors', async () => {
    const onLoadCallback = jest.fn();
    renderPanel(
      {
        state: LoadingState.Error,
        error: { data: { message: '{"status":"error","errorType":"timeout","error":"context deadline exceeded"}' } },
        data: [],
      },
      onLoadCallback
    );
    expect(screen.getByText('Unable to show log volume')).toBeInTheDocument();
    expect(screen.getByText(/The query is trying to access too much data/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onLoadCallback).toHaveBeenCalled();
  });

  it('shows an info message if no log volume data is available', async () => {
    renderPanel({ state: LoadingState.Done, data: [] });
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('No logs volume available')).toBeInTheDocument();
  });

  describe('Visible range', () => {
    it('computes the visible range when logs are passed', async () => {
      const spy = jest.spyOn(logUtils, 'getLogsVisibleRange');
      spy.mockClear();

      renderPanel({ state: LoadingState.Streaming, data: [] });

      expect(spy).not.toHaveBeenCalled();

      const logs = [createLogLine({ timeEpochMs: 1 }), createLogLine({ timeEpochMs: 2 })];

      renderPanel({ state: LoadingState.Streaming, data: [] }, undefined, logs);

      expect(spy).toHaveBeenCalledWith(logs);
    });

    it('does not compute the visible range when an annotation frame is present', async () => {
      const spy = jest.spyOn(logUtils, 'getLogsVisibleRange');
      spy.mockClear();
      const logs = [createLogLine({ timeEpochMs: 1 }), createLogLine({ timeEpochMs: 2 })];
      const loadingFrame = arrayToDataFrame([
        {
          time: 0,
          timeEnd: 1,
          isRegion: true,
          color: 'rgba(120, 120, 120, 0.1)',
        },
      ]);
      loadingFrame.meta = {
        dataTopic: DataTopic.Annotations,
      };

      renderPanel(
        {
          state: LoadingState.Streaming,
          data: [loadingFrame],
        },
        undefined,
        logs
      );

      expect(spy).not.toHaveBeenCalled();
    });
  });
});
