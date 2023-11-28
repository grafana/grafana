import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { openMenu } from 'react-select-event';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';
import { TestProvider } from 'test/helpers/TestProvider';
import { locationService } from '@grafana/runtime';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import appEvents from '../../core/app_events';
import { ShowModalReactEvent } from '../../types/events';
import { AlertHowToModal } from './AlertHowToModal';
import { AlertRuleListUnconnected } from './AlertRuleList';
import { setSearchQuery } from './state/reducers';
jest.mock('../../core/app_events', () => ({
    publish: jest.fn(),
}));
const defaultProps = Object.assign(Object.assign({}, getRouteComponentProps({})), { search: '', isLoading: false, alertRules: [], getAlertRulesAsync: jest.fn().mockResolvedValue([]), setSearchQuery: mockToolkitActionCreator(setSearchQuery), togglePauseAlertRule: jest.fn() });
const setup = (propOverrides) => {
    const props = Object.assign(Object.assign({}, defaultProps), propOverrides);
    const { rerender } = render(React.createElement(TestProvider, null,
        React.createElement(AlertRuleListUnconnected, Object.assign({}, props))));
    return {
        rerender: (element) => rerender(React.createElement(TestProvider, null, element)),
    };
};
afterEach(() => {
    jest.clearAllMocks();
});
describe('AlertRuleList', () => {
    it('should call fetchrules when mounting', () => {
        jest.spyOn(AlertRuleListUnconnected.prototype, 'fetchRules');
        expect(AlertRuleListUnconnected.prototype.fetchRules).not.toHaveBeenCalled();
        setup();
        expect(AlertRuleListUnconnected.prototype.fetchRules).toHaveBeenCalled();
    });
    it('should call fetchrules when props change', () => {
        const fetchRulesSpy = jest.spyOn(AlertRuleListUnconnected.prototype, 'fetchRules');
        expect(AlertRuleListUnconnected.prototype.fetchRules).not.toHaveBeenCalled();
        const { rerender } = setup();
        expect(AlertRuleListUnconnected.prototype.fetchRules).toHaveBeenCalled();
        fetchRulesSpy.mockReset();
        rerender(React.createElement(AlertRuleListUnconnected, Object.assign({}, defaultProps, { queryParams: { state: 'ok' } })));
        expect(AlertRuleListUnconnected.prototype.fetchRules).toHaveBeenCalled();
    });
    describe('Get state filter', () => {
        it('should be all if prop is not set', () => {
            setup();
            expect(screen.getByText('All')).toBeInTheDocument();
        });
        it('should return state filter if set', () => {
            setup({
                queryParams: { state: 'not_ok' },
            });
            expect(screen.getByText('Not OK')).toBeInTheDocument();
        });
    });
    describe('State filter changed', () => {
        it('should update location', () => __awaiter(void 0, void 0, void 0, function* () {
            setup();
            const stateFilterSelect = screen.getByLabelText('States');
            openMenu(stateFilterSelect);
            yield userEvent.click(screen.getByText('Not OK'));
            expect(locationService.getSearchObject().state).toBe('not_ok');
        }));
    });
    describe('Open how to', () => {
        it('should emit show-modal event', () => __awaiter(void 0, void 0, void 0, function* () {
            setup();
            yield userEvent.click(screen.getByRole('button', { name: 'How to add an alert' }));
            expect(appEvents.publish).toHaveBeenCalledWith(new ShowModalReactEvent({ component: AlertHowToModal }));
        }));
    });
    describe('Search query change', () => {
        it('should set search query', () => __awaiter(void 0, void 0, void 0, function* () {
            setup();
            yield userEvent.click(screen.getByPlaceholderText('Search alerts'));
            yield userEvent.paste('dashboard');
            expect(defaultProps.setSearchQuery).toHaveBeenCalledWith('dashboard');
        }));
    });
});
//# sourceMappingURL=AlertRuleList.test.js.map