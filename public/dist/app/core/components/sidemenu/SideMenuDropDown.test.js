import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import SideMenuDropDown from './SideMenuDropDown';
var setup = function (propOverrides) {
    var props = Object.assign({
        link: {
            text: 'link',
        },
    }, propOverrides);
    return shallow(React.createElement(SideMenuDropDown, tslib_1.__assign({}, props)));
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup();
        expect(wrapper).toMatchSnapshot();
    });
    it('should render children', function () {
        var wrapper = setup({
            link: {
                text: 'link',
                children: [{ id: 1 }, { id: 2 }, { id: 3 }],
            },
        });
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=SideMenuDropDown.test.js.map