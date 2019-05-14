import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { DashboardModel } from '../dashboard/state/DashboardModel';
import { TestRuleResult } from './TestRuleResult';
jest.mock('app/core/services/backend_srv', function () { return ({
    getBackendSrv: function () { return ({
        post: jest.fn(),
    }); },
}); });
var setup = function (propOverrides) {
    var props = {
        panelId: 1,
        dashboard: new DashboardModel({ panels: [{ id: 1 }] }),
    };
    Object.assign(props, propOverrides);
    var wrapper = shallow(React.createElement(TestRuleResult, tslib_1.__assign({}, props)));
    return { wrapper: wrapper, instance: wrapper.instance() };
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup().wrapper;
        expect(wrapper).toMatchSnapshot();
    });
});
describe('Life cycle', function () {
    describe('component did mount', function () {
        it('should call testRule', function () {
            var instance = setup().instance;
            instance.testRule = jest.fn();
            instance.componentDidMount();
            expect(instance.testRule).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=TestRuleResult.test.js.map