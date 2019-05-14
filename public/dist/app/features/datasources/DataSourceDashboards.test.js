import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { DataSourceDashboards } from './DataSourceDashboards';
var setup = function (propOverrides) {
    var props = {
        navModel: {},
        dashboards: [],
        dataSource: {},
        pageId: 1,
        importDashboard: jest.fn(),
        loadDataSource: jest.fn(),
        loadPluginDashboards: jest.fn(),
        removeDashboard: jest.fn(),
        isLoading: false,
    };
    Object.assign(props, propOverrides);
    return shallow(React.createElement(DataSourceDashboards, tslib_1.__assign({}, props)));
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup();
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=DataSourceDashboards.test.js.map