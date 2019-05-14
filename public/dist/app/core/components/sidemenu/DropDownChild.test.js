import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import DropDownChild from './DropDownChild';
var setup = function (propOverrides) {
    var props = Object.assign({
        child: {
            divider: true,
        },
    }, propOverrides);
    return shallow(React.createElement(DropDownChild, tslib_1.__assign({}, props)));
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup();
        expect(wrapper).toMatchSnapshot();
    });
    it('should render icon if exists', function () {
        var wrapper = setup({
            child: {
                divider: false,
                icon: 'icon-test',
            },
        });
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=DropDownChild.test.js.map