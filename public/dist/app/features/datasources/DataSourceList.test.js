import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import DataSourcesList from './DataSourcesList';
import { getMockDataSources } from './__mocks__/dataSourcesMocks';
import { LayoutModes } from '../../core/components/LayoutSelector/LayoutSelector';
var setup = function () {
    var props = {
        dataSources: getMockDataSources(3),
        layoutMode: LayoutModes.Grid,
    };
    return shallow(React.createElement(DataSourcesList, tslib_1.__assign({}, props)));
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup();
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=DataSourceList.test.js.map