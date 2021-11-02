import { __assign } from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { LayoutModes } from '@grafana/data';
import { DataSourcesListPage } from './DataSourcesListPage';
import { getMockDataSources } from './__mocks__/dataSourcesMocks';
import { setDataSourcesLayoutMode, setDataSourcesSearchQuery } from './state/reducers';
jest.mock('app/core/core', function () {
    return {
        contextSrv: {
            hasPermission: function () { return true; },
        },
    };
});
var setup = function (propOverrides) {
    var props = {
        dataSources: [],
        layoutMode: LayoutModes.Grid,
        loadDataSources: jest.fn(),
        navModel: {
            main: {
                text: 'Configuration',
            },
            node: {
                text: 'Data Sources',
            },
        },
        dataSourcesCount: 0,
        searchQuery: '',
        setDataSourcesSearchQuery: setDataSourcesSearchQuery,
        setDataSourcesLayoutMode: setDataSourcesLayoutMode,
        hasFetched: false,
    };
    Object.assign(props, propOverrides);
    return shallow(React.createElement(DataSourcesListPage, __assign({}, props)));
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup();
        expect(wrapper).toMatchSnapshot();
    });
    it('should render action bar and datasources', function () {
        var wrapper = setup({
            dataSources: getMockDataSources(5),
            dataSourcesCount: 5,
            hasFetched: true,
        });
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=DataSourcesListPage.test.js.map