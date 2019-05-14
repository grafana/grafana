import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import TopSection from './TopSection';
jest.mock('../../config', function () { return ({
    bootData: {
        navTree: [
            { id: '1', hideFromMenu: true },
            { id: '2', hideFromMenu: true },
            { id: '3', hideFromMenu: false },
            { id: '4', hideFromMenu: true },
        ],
    },
}); });
var setup = function (propOverrides) {
    var props = Object.assign({
        mainLinks: [],
    }, propOverrides);
    return shallow(React.createElement(TopSection, tslib_1.__assign({}, props)));
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup();
        expect(wrapper).toMatchSnapshot();
    });
    it('should render items', function () {
        var wrapper = setup({
            mainLinks: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
        });
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=TopSection.test.js.map