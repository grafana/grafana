import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import DashboardsTable from './DashboardsTable';
var setup = function (propOverrides) {
    var props = {
        dashboards: [],
        onImport: jest.fn(),
        onRemove: jest.fn(),
    };
    Object.assign(props, propOverrides);
    return shallow(React.createElement(DashboardsTable, tslib_1.__assign({}, props)));
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup();
        expect(wrapper).toMatchSnapshot();
    });
    it('should render table', function () {
        var wrapper = setup({
            dashboards: [
                {
                    dashboardId: 0,
                    description: '',
                    folderId: 0,
                    imported: false,
                    importedRevision: 0,
                    importedUri: '',
                    importedUrl: '',
                    path: 'dashboards/carbon_metrics.json',
                    pluginId: 'graphite',
                    removed: false,
                    revision: 1,
                    slug: '',
                    title: 'Graphite Carbon Metrics',
                },
                {
                    dashboardId: 0,
                    description: '',
                    folderId: 0,
                    imported: true,
                    importedRevision: 0,
                    importedUri: '',
                    importedUrl: '',
                    path: 'dashboards/carbon_metrics.json',
                    pluginId: 'graphite',
                    removed: false,
                    revision: 1,
                    slug: '',
                    title: 'Graphite Carbon Metrics',
                },
            ],
        });
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=DashboardsTable.test.js.map