import { __assign } from "tslib";
import React from 'react';
import { render, screen } from '@testing-library/react';
import DataSourcesList from './DataSourcesList';
import { getMockDataSources } from './__mocks__/dataSourcesMocks';
import { LayoutModes } from '@grafana/data';
var setup = function () {
    var props = {
        dataSources: getMockDataSources(3),
        layoutMode: LayoutModes.Grid,
    };
    return render(React.createElement(DataSourcesList, __assign({}, props)));
};
describe('DataSourcesList', function () {
    it('should render list of datasources', function () {
        setup();
        expect(screen.getAllByRole('listitem')).toHaveLength(3);
        expect(screen.getAllByRole('heading')).toHaveLength(3);
    });
    it('should render all elements in the list item', function () {
        setup();
        expect(screen.getByRole('heading', { name: 'dataSource-0' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'dataSource-0 dataSource-0' })).toBeInTheDocument();
        expect(screen.getByAltText('dataSource-0')).toBeInTheDocument();
    });
});
//# sourceMappingURL=DataSourceList.test.js.map