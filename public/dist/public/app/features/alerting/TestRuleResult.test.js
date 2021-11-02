import { __assign } from "tslib";
import React from 'react';
import { TestRuleResult } from './TestRuleResult';
import { DashboardModel, PanelModel } from '../dashboard/state';
import { shallow } from 'enzyme';
jest.mock('@grafana/runtime', function () {
    var original = jest.requireActual('@grafana/runtime');
    return __assign(__assign({}, original), { getBackendSrv: function () { return ({
            post: jest.fn(),
        }); } });
});
var setup = function (propOverrides) {
    var props = {
        panel: new PanelModel({ id: 1 }),
        dashboard: new DashboardModel({ panels: [{ id: 1 }] }),
    };
    Object.assign(props, propOverrides);
    var wrapper = shallow(React.createElement(TestRuleResult, __assign({}, props)));
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