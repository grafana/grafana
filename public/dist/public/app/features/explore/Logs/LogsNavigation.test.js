import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { LogsSortOrder } from '@grafana/data';
import LogsNavigation from './LogsNavigation';
// we have to mock out reportInteraction, otherwise it crashes the test.
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { reportInteraction: () => null })));
const defaultProps = {
    absoluteRange: { from: 1637319381811, to: 1637322981811 },
    timeZone: 'local',
    queries: [],
    loading: false,
    logsSortOrder: undefined,
    visibleRange: { from: 1637322959000, to: 1637322981811 },
    onChangeTime: jest.fn(),
    scrollToTopLogs: jest.fn(),
    addResultsToCache: jest.fn(),
    clearCache: jest.fn(),
};
const setup = (propOverrides) => {
    const props = Object.assign(Object.assign({}, defaultProps), propOverrides);
    return render(React.createElement(LogsNavigation, Object.assign({}, props)));
};
describe('LogsNavigation', () => {
    it('should always render 3 navigation buttons', () => {
        setup();
        expect(screen.getByTestId('newerLogsButton')).toBeInTheDocument();
        expect(screen.getByTestId('olderLogsButton')).toBeInTheDocument();
        expect(screen.getByTestId('scrollToTop')).toBeInTheDocument();
    });
    it('should render 3 navigation buttons in correct order when default logs order', () => {
        const { container } = setup();
        const expectedOrder = ['newerLogsButton', 'olderLogsButton', 'scrollToTop'];
        const elements = container.querySelectorAll('[data-testid=newerLogsButton],[data-testid=olderLogsButton],[data-testid=scrollToTop]');
        expect(Array.from(elements).map((el) => el.getAttribute('data-testid'))).toMatchObject(expectedOrder);
    });
    it('should render 3 navigation buttons in correct order when flipped logs order', () => {
        const { container } = setup({ logsSortOrder: LogsSortOrder.Ascending });
        const expectedOrder = ['olderLogsButton', 'newerLogsButton', 'scrollToTop'];
        const elements = container.querySelectorAll('[data-testid=newerLogsButton],[data-testid=olderLogsButton],[data-testid=scrollToTop]');
        expect(Array.from(elements).map((el) => el.getAttribute('data-testid'))).toMatchObject(expectedOrder);
    });
    it('should disable fetch buttons when logs are loading', () => {
        setup({ loading: true });
        const olderLogsButton = screen.getByTestId('olderLogsButton');
        const newerLogsButton = screen.getByTestId('newerLogsButton');
        expect(olderLogsButton).toBeDisabled();
        expect(newerLogsButton).toBeDisabled();
    });
    it('should render logs navigation pages section', () => {
        setup();
        expect(screen.getByTestId('logsNavigationPages')).toBeInTheDocument();
    });
    it('should correctly request older logs when flipped order', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChangeTimeMock = jest.fn();
        const { rerender } = setup({ onChangeTime: onChangeTimeMock });
        yield userEvent.click(screen.getByTestId('olderLogsButton'));
        expect(onChangeTimeMock).toHaveBeenCalledWith({ from: 1637319359000, to: 1637322959000 });
        rerender(React.createElement(LogsNavigation, Object.assign({}, defaultProps, { absoluteRange: { from: 1637319359000, to: 1637322959000 }, visibleRange: { from: 1637322938000, to: 1637322959000 }, onChangeTime: onChangeTimeMock, logsSortOrder: LogsSortOrder.Ascending })));
        yield userEvent.click(screen.getByTestId('olderLogsButton'));
        expect(onChangeTimeMock).toHaveBeenCalledWith({ from: 1637319338000, to: 1637322938000 });
    }));
    it('should reset the scroll when pagination is clicked', () => __awaiter(void 0, void 0, void 0, function* () {
        const scrollToTopLogsMock = jest.fn();
        setup({ scrollToTopLogs: scrollToTopLogsMock });
        expect(scrollToTopLogsMock).not.toHaveBeenCalled();
        yield userEvent.click(screen.getByTestId('olderLogsButton'));
        expect(scrollToTopLogsMock).toHaveBeenCalled();
    }));
});
//# sourceMappingURL=LogsNavigation.test.js.map