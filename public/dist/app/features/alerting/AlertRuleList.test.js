import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { AlertRuleList } from './AlertRuleList';
import appEvents from '../../core/app_events';
jest.mock('../../core/app_events', function () { return ({
    emit: jest.fn(),
}); });
var setup = function (propOverrides) {
    var props = {
        navModel: {},
        alertRules: [],
        updateLocation: jest.fn(),
        getAlertRulesAsync: jest.fn(),
        setSearchQuery: jest.fn(),
        togglePauseAlertRule: jest.fn(),
        stateFilter: '',
        search: '',
        isLoading: false,
    };
    Object.assign(props, propOverrides);
    var wrapper = shallow(React.createElement(AlertRuleList, tslib_1.__assign({}, props)));
    return {
        wrapper: wrapper,
        instance: wrapper.instance(),
    };
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup().wrapper;
        expect(wrapper).toMatchSnapshot();
    });
    it('should render alert rules', function () {
        var wrapper = setup({
            alertRules: [
                {
                    id: 1,
                    dashboardId: 7,
                    dashboardUid: 'ggHbN42mk',
                    dashboardSlug: 'alerting-with-testdata',
                    panelId: 3,
                    name: 'TestData - Always OK',
                    state: 'ok',
                    newStateDate: '2018-09-04T10:01:01+02:00',
                    evalDate: '0001-01-01T00:00:00Z',
                    evalData: {},
                    executionError: '',
                    url: '/d/ggHbN42mk/alerting-with-testdata',
                },
                {
                    id: 3,
                    dashboardId: 7,
                    dashboardUid: 'ggHbN42mk',
                    dashboardSlug: 'alerting-with-testdata',
                    panelId: 3,
                    name: 'TestData - ok',
                    state: 'ok',
                    newStateDate: '2018-09-04T10:01:01+02:00',
                    evalDate: '0001-01-01T00:00:00Z',
                    evalData: {},
                    executionError: 'error',
                    url: '/d/ggHbN42mk/alerting-with-testdata',
                },
            ],
        }).wrapper;
        expect(wrapper).toMatchSnapshot();
    });
});
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
            instance.componentDidUpdate({ stateFilter: 'ok' });
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
                stateFilter: 'ok',
            }).instance;
            var stateFilter = instance.getStateFilter();
            expect(stateFilter).toEqual('ok');
        });
    });
    describe('State filter changed', function () {
        it('should update location', function () {
            var instance = setup().instance;
            var mockEvent = { target: { value: 'alerting' } };
            instance.onStateFilterChanged(mockEvent);
            expect(instance.props.updateLocation).toHaveBeenCalledWith({ query: { state: 'alerting' } });
        });
    });
    describe('Open how to', function () {
        it('should emit show-modal event', function () {
            var instance = setup().instance;
            instance.onOpenHowTo();
            expect(appEvents.emit).toHaveBeenCalledWith('show-modal', {
                src: 'public/app/features/alerting/partials/alert_howto.html',
                modalClass: 'confirm-modal',
                model: {},
            });
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