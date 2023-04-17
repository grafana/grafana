import { render, screen } from '@testing-library/react';
import React from 'react';

import { DataQueryResponse, LoadingState, EventBusSrv } from '@grafana/data';

import { LogsVolumePanel } from './LogsVolumePanel';

jest.mock('./Graph/ExploreGraph', () => {
  const ExploreGraph = () => <span>ExploreGraph</span>;
  return {
    ExploreGraph,
  };
});

function renderPanel(logsVolumeData?: DataQueryResponse) {
  render(
    <LogsVolumePanel
      absoluteRange={{ from: 0, to: 1 }}
      timeZone="timeZone"
      splitOpen={() => {}}
      width={100}
      onUpdateTimeRange={() => {}}
      logsVolumeData={logsVolumeData}
      onLoadLogsVolume={() => {}}
      onHiddenSeriesChanged={() => null}
      eventBus={new EventBusSrv()}
      allLogsVolumeMaximum={20}
    />
  );
}

describe('LogsVolumePanel', () => {
  it('shows no volume data', () => {
    renderPanel({ state: LoadingState.Done, error: undefined, data: [] });
    expect(screen.getByText('No volume data.')).toBeInTheDocument();
  });

  it('renders logs volume histogram graph', () => {
    renderPanel({ state: LoadingState.Done, error: undefined, data: [{}] });
    expect(screen.getByText('ExploreGraph')).toBeInTheDocument();
  });

  it('does not show the panel when there is no volume data', () => {
    renderPanel(undefined);
    expect(screen.queryByText('Log volume')).not.toBeInTheDocument();
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
