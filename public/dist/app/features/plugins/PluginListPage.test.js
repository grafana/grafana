import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { PluginListPage } from './PluginListPage';
import { LayoutModes } from '../../core/components/LayoutSelector/LayoutSelector';
var setup = function (propOverrides) {
    var props = {
        navModel: {
            main: {
                text: 'Configuration',
            },
            node: {
                text: 'Plugins',
            },
        },
        plugins: [],
        searchQuery: '',
        setPluginsSearchQuery: jest.fn(),
        setPluginsLayoutMode: jest.fn(),
        layoutMode: LayoutModes.Grid,
        loadPlugins: jest.fn(),
        hasFetched: false,
    };
    Object.assign(props, propOverrides);
    return shallow(React.createElement(PluginListPage, tslib_1.__assign({}, props)));
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup();
        expect(wrapper).toMatchSnapshot();
    });
    it('should render list', function () {
        var wrapper = setup({
            hasFetched: true,
        });
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=PluginListPage.test.js.map