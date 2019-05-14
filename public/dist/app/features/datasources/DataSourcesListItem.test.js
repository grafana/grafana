import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import DataSourcesListItem from './DataSourcesListItem';
import { getMockDataSource } from './__mocks__/dataSourcesMocks';
var setup = function () {
    var props = {
        dataSource: getMockDataSource(),
    };
    return shallow(React.createElement(DataSourcesListItem, tslib_1.__assign({}, props)));
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup();
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=DataSourcesListItem.test.js.map