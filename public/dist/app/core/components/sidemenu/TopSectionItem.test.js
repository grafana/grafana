import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import TopSectionItem from './TopSectionItem';
var setup = function (propOverrides) {
    var props = Object.assign({
        link: {},
    }, propOverrides);
    return shallow(React.createElement(TopSectionItem, tslib_1.__assign({}, props)));
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup();
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=TopSectionItem.test.js.map