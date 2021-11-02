import { __assign } from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import PluginListItem from './PluginListItem';
import { getMockPlugin } from './__mocks__/pluginMocks';
var setup = function (propOverrides) {
    var props = Object.assign({
        plugin: getMockPlugin(),
    }, propOverrides);
    return shallow(React.createElement(PluginListItem, __assign({}, props)));
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup();
        expect(wrapper).toMatchSnapshot();
    });
    it('should render has plugin section', function () {
        var mockPlugin = getMockPlugin();
        mockPlugin.hasUpdate = true;
        var wrapper = setup({
            plugin: mockPlugin,
        });
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=PluginListItem.test.js.map