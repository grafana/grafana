import { __assign } from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { DataSourceDashboards } from './DataSourceDashboards';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
var setup = function (propOverrides) {
    var props = __assign(__assign({}, getRouteComponentProps()), { navModel: {}, dashboards: [], dataSource: {}, dataSourceId: 'x', importDashboard: jest.fn(), loadDataSource: jest.fn(), loadPluginDashboards: jest.fn(), removeDashboard: jest.fn(), isLoading: false });
    Object.assign(props, propOverrides);
    return shallow(React.createElement(DataSourceDashboards, __assign({}, props)));
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup();
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=DataSourceDashboards.test.js.map