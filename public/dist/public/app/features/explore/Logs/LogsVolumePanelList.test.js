import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { LoadingState, EventBusSrv } from '@grafana/data';
import { LogsVolumePanelList } from './LogsVolumePanelList';
jest.mock('../Graph/ExploreGraph', () => {
    const ExploreGraph = () => React.createElement("span", null, "ExploreGraph");
    return {
        ExploreGraph,
    };
});
function renderPanel(logsVolumeData, onLoadLogsVolume = () => { }) {
    render(React.createElement(LogsVolumePanelList, { absoluteRange: { from: 0, to: 1 }, timeZone: "timeZone", splitOpen: () => { }, width: 100, onUpdateTimeRange: () => { }, logsVolumeData: logsVolumeData, onLoadLogsVolume: onLoadLogsVolume, onHiddenSeriesChanged: () => null, eventBus: new EventBusSrv() }));
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
    it('shows long warning message', () => __awaiter(void 0, void 0, void 0, function* () {
        // we make a long message
        const messagePart = 'One two three four five six seven eight nine ten.';
        const message = messagePart + ' ' + messagePart + ' ' + messagePart;
        renderPanel({ state: LoadingState.Error, error: { data: { message } }, data: [] });
        expect(screen.getByText('Failed to load log volume for this query')).toBeInTheDocument();
        expect(screen.queryByText(message)).not.toBeInTheDocument();
        yield userEvent.click(screen.getByRole('button', { name: 'Show details' }));
        expect(screen.getByText(message)).toBeInTheDocument();
    }));
    it('a custom message for timeout errors', () => __awaiter(void 0, void 0, void 0, function* () {
        const onLoadCallback = jest.fn();
        renderPanel({
            state: LoadingState.Error,
            error: { data: { message: '{"status":"error","errorType":"timeout","error":"context deadline exceeded"}' } },
            data: [],
        }, onLoadCallback);
        expect(screen.getByText('The logs volume query has timed out')).toBeInTheDocument();
        yield userEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(onLoadCallback).toHaveBeenCalled();
    }));
    it('shows an info message if no log volume data is available', () => __awaiter(void 0, void 0, void 0, function* () {
        renderPanel({ state: LoadingState.Done, data: [] });
        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(screen.getByText('No logs volume available')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=LogsVolumePanelList.test.js.map