import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ChunkedLogsViewer } from './ChunkedLogsViewer';
import { Messages } from './ChunkedLogsViewer.messages';
describe('ChunkedLogsViewer', () => {
    const getMockedLogsGetter = (logs, timeout = 10) => {
        return jest.fn().mockReturnValue(new Promise((resolve) => setTimeout(() => resolve(logs), timeout)));
    };
    beforeEach(() => {
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });
    it('should show processing state in the beginning', () => {
        const getLogs = getMockedLogsGetter({ logs: [], end: false });
        render(React.createElement(ChunkedLogsViewer, { getLogChunks: getLogs }));
        expect(screen.getByText(Messages.loading)).toBeInTheDocument();
    });
    it('should show "no logs" message after loading is done', () => __awaiter(void 0, void 0, void 0, function* () {
        const getLogs = getMockedLogsGetter({ logs: [], end: true });
        render(React.createElement(ChunkedLogsViewer, { getLogChunks: getLogs }));
        yield waitFor(() => {
            expect(screen.getByText(Messages.noLogs)).toBeInTheDocument();
        });
    }));
    it('should show logs', () => __awaiter(void 0, void 0, void 0, function* () {
        const getLogs = getMockedLogsGetter({
            logs: [
                { id: 0, data: 'Log 1', time: '' },
                { id: 1, data: 'Log 2', time: '' },
            ],
            end: true,
        });
        render(React.createElement(ChunkedLogsViewer, { getLogChunks: getLogs }));
        yield waitFor(() => {
            expect(screen.getByText((content) => content.includes('Log 1') && content.includes('Log 2'))).toBeInTheDocument();
        });
    }));
});
//# sourceMappingURL=ChunkedLogsViewer.test.js.map