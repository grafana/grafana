import { render, screen } from '@testing-library/react';

import { DataQueryResponse, LoadingState, EventBusSrv, dateTime } from '@grafana/data';

import { LogsVolumePanel } from './LogsVolumePanel';

jest.mock('../Graph/ExploreGraph', () => {
  const ExploreGraph = () => <span>ExploreGraph</span>;
  return {
    ExploreGraph,
  };
});

function renderPanel(logsVolumeData: DataQueryResponse) {
  render(
    <LogsVolumePanel
      timeRange={{ from: dateTime(0), to: dateTime(1), raw: { from: dateTime(0), to: dateTime(1) } }}
      timeZone="timeZone"
      splitOpen={() => {}}
      width={100}
      onUpdateTimeRange={() => {}}
      logsVolumeData={logsVolumeData}
      onLoadLogsVolume={() => {}}
      onHiddenSeriesChanged={() => null}
      eventBus={new EventBusSrv()}
      allLogsVolumeMaximum={20}
      annotations={[]}
    />
  );
}

describe('LogsVolumePanel', () => {
  it('renders logs volume histogram graph', () => {
    renderPanel({ state: LoadingState.Done, error: undefined, data: [{}] });
    expect(screen.getByText('ExploreGraph')).toBeInTheDocument();
  });

  it('renders a loading indicator when data is streaming', () => {
    renderPanel({ state: LoadingState.Streaming, error: undefined, data: [{}] });
    expect(screen.getByTestId('logs-volume-streaming')).toBeInTheDocument();
  });

  it('does not render loading indicator when data is not streaming', () => {
    renderPanel({ state: LoadingState.Done, error: undefined, data: [{}] });
    expect(screen.queryByText('logs-volume-streaming')).not.toBeInTheDocument();
  });
});
