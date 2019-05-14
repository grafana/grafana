import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import AlertRuleItem from './AlertRuleItem';
jest.mock('react-redux', function () { return ({
    connect: function () { return function (params) { return params; }; },
}); });
var setup = function (propOverrides) {
    var props = {
        rule: {
            id: 1,
            dashboardId: 1,
            panelId: 1,
            name: 'Some rule',
            state: 'Open',
            stateText: 'state text',
            stateIcon: 'icon',
            stateClass: 'state class',
            stateAge: 'age',
            url: 'https://something.something.darkside',
        },
        search: '',
        onTogglePause: jest.fn(),
    };
    Object.assign(props, propOverrides);
    return shallow(React.createElement(AlertRuleItem, tslib_1.__assign({}, props)));
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup();
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=AlertRuleItem.test.js.map