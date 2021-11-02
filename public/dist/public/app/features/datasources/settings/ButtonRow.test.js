import { __assign } from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import ButtonRow from './ButtonRow';
jest.mock('app/core/core', function () {
    return {
        contextSrv: {
            hasPermission: function () { return true; },
        },
    };
});
var setup = function (propOverrides) {
    var props = {
        isReadOnly: true,
        onSubmit: jest.fn(),
        onDelete: jest.fn(),
        onTest: jest.fn(),
        exploreUrl: '/explore',
    };
    Object.assign(props, propOverrides);
    return shallow(React.createElement(ButtonRow, __assign({}, props)));
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup();
        expect(wrapper).toMatchSnapshot();
    });
    it('should render with buttons enabled', function () {
        var wrapper = setup({
            isReadOnly: false,
        });
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=ButtonRow.test.js.map