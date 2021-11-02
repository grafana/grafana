import { __assign } from "tslib";
import React from 'react';
import { render, screen } from '@testing-library/react';
import { LogsSortOrder } from '@grafana/data';
import LogsNavigation from './LogsNavigation';
var setup = function (propOverrides) {
    var props = __assign({ absoluteRange: { from: 1619081645930, to: 1619081945930 }, timeZone: 'local', queries: [], loading: false, logsSortOrder: undefined, visibleRange: { from: 1619081941000, to: 1619081945930 }, onChangeTime: jest.fn(), scrollToTopLogs: jest.fn(), addResultsToCache: jest.fn(), clearCache: jest.fn() }, propOverrides);
    return render(React.createElement(LogsNavigation, __assign({}, props)));
};
describe('LogsNavigation', function () {
    it('should always render 3 navigation buttons', function () {
        setup();
        expect(screen.getByTestId('newerLogsButton')).toBeInTheDocument();
        expect(screen.getByTestId('olderLogsButton')).toBeInTheDocument();
        expect(screen.getByTestId('scrollToTop')).toBeInTheDocument();
    });
    it('should render 3 navigation buttons in correct order when default logs order', function () {
        var container = setup().container;
        var expectedOrder = ['newerLogsButton', 'olderLogsButton', 'scrollToTop'];
        var elements = container.querySelectorAll('[data-testid=newerLogsButton],[data-testid=olderLogsButton],[data-testid=scrollToTop]');
        expect(Array.from(elements).map(function (el) { return el.getAttribute('data-testid'); })).toMatchObject(expectedOrder);
    });
    it('should render 3 navigation buttons in correect order when flipped logs order', function () {
        var container = setup({ logsSortOrder: LogsSortOrder.Ascending }).container;
        var expectedOrder = ['olderLogsButton', 'newerLogsButton', 'scrollToTop'];
        var elements = container.querySelectorAll('[data-testid=newerLogsButton],[data-testid=olderLogsButton],[data-testid=scrollToTop]');
        expect(Array.from(elements).map(function (el) { return el.getAttribute('data-testid'); })).toMatchObject(expectedOrder);
    });
    it('should disable fetch buttons when logs are loading', function () {
        setup({ loading: true });
        var olderLogsButton = screen.getByTestId('olderLogsButton');
        var newerLogsButton = screen.getByTestId('newerLogsButton');
        expect(olderLogsButton).toBeDisabled();
        expect(newerLogsButton).toBeDisabled();
    });
    it('should render logs navigation pages section', function () {
        setup();
        expect(screen.getByTestId('logsNavigationPages')).toBeInTheDocument();
    });
});
//# sourceMappingURL=LogsNavigation.test.js.map