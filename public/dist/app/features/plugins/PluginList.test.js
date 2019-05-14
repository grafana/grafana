import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import PluginList from './PluginList';
import { getMockPlugins } from './__mocks__/pluginMocks';
import { LayoutModes } from '../../core/components/LayoutSelector/LayoutSelector';
var setup = function (propOverrides) {
    var props = Object.assign({
        plugins: getMockPlugins(5),
        layoutMode: LayoutModes.Grid,
    }, propOverrides);
    return shallow(React.createElement(PluginList, tslib_1.__assign({}, props)));
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup();
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=PluginList.test.js.map