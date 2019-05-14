import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import ButtonRow from './ButtonRow';
var setup = function (propOverrides) {
    var props = {
        isReadOnly: true,
        onSubmit: jest.fn(),
        onDelete: jest.fn(),
        onTest: jest.fn(),
    };
    Object.assign(props, propOverrides);
    return shallow(React.createElement(ButtonRow, tslib_1.__assign({}, props)));
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