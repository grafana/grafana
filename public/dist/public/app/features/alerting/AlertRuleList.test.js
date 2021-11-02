import { __assign } from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { AlertRuleListUnconnected } from './AlertRuleList';
import appEvents from '../../core/app_events';
import { setSearchQuery } from './state/reducers';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { locationService } from '@grafana/runtime';
import { ShowModalReactEvent } from '../../types/events';
import { AlertHowToModal } from './AlertHowToModal';
jest.mock('../../core/app_events', function () { return ({
    publish: jest.fn(),
}); });
var setup = function (propOverrides) {
    var props = __assign(__assign({}, getRouteComponentProps({})), { navModel: {}, alertRules: [], getAlertRulesAsync: jest.fn(), setSearchQuery: mockToolkitActionCreator(setSearchQuery), togglePauseAlertRule: jest.fn(), search: '', isLoading: false });
    Object.assign(props, propOverrides);
    var wrapper = shallow(React.createElement(AlertRuleListUnconnected, __assign({}, props)));
    return {
        wrapper: wrapper,
        instance: wrapper.instance(),
    };
};
describe('Life cycle', function () {
    describe('component did mount', function () {
        it('should call fetchrules', function () {
            var instance = setup().instance;
            instance.fetchRules = jest.fn();
            instance.componentDidMount();
            expect(instance.fetchRules).toHaveBeenCalled();
        });
    });
    describe('component did update', function () {
        it('should call fetchrules if props differ', function () {
            var instance = setup().instance;
            instance.fetchRules = jest.fn();
            instance.componentDidUpdate({ queryParams: { state: 'ok' } });
            expect(instance.fetchRules).toHaveBeenCalled();
        });
    });
});
describe('Functions', function () {
    describe('Get state filter', function () {
        it('should get all if prop is not set', function () {
            var instance = setup().instance;
            var stateFilter = instance.getStateFilter();
            expect(stateFilter).toEqual('all');
        });
        it('should return state filter if set', function () {
            var instance = setup({
                queryParams: { state: 'ok' },
            }).instance;
            var stateFilter = instance.getStateFilter();
            expect(stateFilter).toEqual('ok');
        });
    });
    describe('State filter changed', function () {
        it('should update location', function () {
            var instance = setup().instance;
            var mockEvent = { value: 'alerting' };
            instance.onStateFilterChanged(mockEvent);
            expect(locationService.getSearchObject().state).toBe('alerting');
        });
    });
    describe('Open how to', function () {
        it('should emit show-modal event', function () {
            var instance = setup().instance;
            instance.onOpenHowTo();
            expect(appEvents.publish).toHaveBeenCalledWith(new ShowModalReactEvent({ component: AlertHowToModal }));
        });
    });
    describe('Search query change', function () {
        it('should set search query', function () {
            var instance = setup().instance;
            instance.onSearchQueryChange('dashboard');
            expect(instance.props.setSearchQuery).toHaveBeenCalledWith('dashboard');
        });
    });
});
//# sourceMappingURL=AlertRuleList.test.js.map