import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { Graph } from './Graph';
import { mockData } from './__mocks__/mockData';
var setup = function (propOverrides) {
    var props = tslib_1.__assign({ size: { width: 10, height: 20 }, data: mockData().slice(0, 19), range: { from: 'now-6h', to: 'now' } }, propOverrides);
    // Enzyme.shallow did not work well with jquery.flop. Mocking the draw function.
    Graph.prototype.draw = jest.fn();
    var wrapper = shallow(React.createElement(Graph, tslib_1.__assign({}, props)));
    var instance = wrapper.instance();
    return {
        wrapper: wrapper,
        instance: instance,
    };
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup().wrapper;
        expect(wrapper).toMatchSnapshot();
    });
    it('should render component with disclaimer', function () {
        var wrapper = setup({
            data: mockData(),
        }).wrapper;
        expect(wrapper).toMatchSnapshot();
    });
    it('should show query return no time series', function () {
        var wrapper = setup({
            data: [],
        }).wrapper;
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=Graph.test.js.map