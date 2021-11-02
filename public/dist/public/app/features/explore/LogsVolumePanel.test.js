import React from 'react';
import { render, screen } from '@testing-library/react';
import { LogsVolumePanel } from './LogsVolumePanel';
import { LoadingState } from '@grafana/data';
jest.mock('./ExploreGraph', function () {
    var ExploreGraph = function () { return React.createElement("span", null, "ExploreGraph"); };
    return {
        ExploreGraph: ExploreGraph,
    };
});
function renderPanel(logsVolumeData) {
    render(React.createElement(LogsVolumePanel, { absoluteRange: { from: 0, to: 1 }, timeZone: "timeZone", splitOpen: function () { }, width: 100, onUpdateTimeRange: function () { }, logsVolumeData: logsVolumeData, onLoadLogsVolume: function () { } }));
}
describe('LogsVolumePanel', function () {
    it('shows loading message', function () {
        renderPanel({ state: LoadingState.Loading, error: undefined, data: [] });
        expect(screen.getByText('Logs volume is loading...')).toBeInTheDocument();
    });
    it('shows no volume data', function () {
        renderPanel({ state: LoadingState.Done, error: undefined, data: [] });
        expect(screen.getByText('No volume data.')).toBeInTheDocument();
    });
    it('renders logs volume histogram graph', function () {
        renderPanel({ state: LoadingState.Done, error: undefined, data: [{}] });
        expect(screen.getByText('ExploreGraph')).toBeInTheDocument();
    });
    it('shows error message', function () {
        renderPanel({ state: LoadingState.Error, error: { data: { message: 'Test error message' } }, data: [] });
        expect(screen.getByText('Failed to load volume logs for this query')).toBeInTheDocument();
        expect(screen.getByText('Test error message')).toBeInTheDocument();
    });
    it('does not show the panel when there is no volume data', function () {
        renderPanel(undefined);
        expect(screen.queryByText('Logs volume')).not.toBeInTheDocument();
    });
});
//# sourceMappingURL=LogsVolumePanel.test.js.map