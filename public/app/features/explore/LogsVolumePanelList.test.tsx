import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { DataQueryResponse, LoadingState, EventBusSrv } from '@grafana/data';

import { LogsVolumePanelList } from './LogsVolumePanelList';

jest.mock('./Graph/ExploreGraph', () => {
  const ExploreGraph = () => <span>ExploreGraph</span>;
  return {
    ExploreGraph,
  };
});

function renderPanel(logsVolumeData?: DataQueryResponse) {
  render(
    <LogsVolumePanelList
      absoluteRange={{ from: 0, to: 1 }}
      timeZone="timeZone"
      splitOpen={() => {}}
      width={100}
      onUpdateTimeRange={() => {}}
      logsVolumeData={logsVolumeData}
      onLoadLogsVolume={() => {}}
      onHiddenSeriesChanged={() => null}
      eventBus={new EventBusSrv()}
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

  it('shows long warning message', () => {
    // we make a long message
    const messagePart = 'One two three four five six seven eight nine ten.';
    const message = messagePart + ' ' + messagePart + ' ' + messagePart;

    renderPanel({ state: LoadingState.Error, error: { data: { message } }, data: [] });
    expect(screen.getByText('Failed to load log volume for this query')).toBeInTheDocument();
    expect(screen.queryByText(message)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show details' }));
    expect(screen.getByText(message)).toBeInTheDocument();
  });
});
