import { __assign } from "tslib";
import React from 'react';
import { mount } from 'enzyme';
import { ExploreId } from '../../../types/explore';
import { SortOrder } from 'app/core/utils/richHistory';
import { RichHistoryStarredTab } from './RichHistoryStarredTab';
jest.mock('../state/selectors', function () { return ({ getExploreDatasources: jest.fn() }); });
var setup = function (propOverrides) {
    var props = {
        queries: [],
        sortOrder: SortOrder.Ascending,
        activeDatasourceOnly: false,
        datasourceFilters: [],
        exploreId: ExploreId.left,
        onChangeSortOrder: jest.fn(),
        onSelectDatasourceFilters: jest.fn(),
    };
    Object.assign(props, propOverrides);
    var wrapper = mount(React.createElement(RichHistoryStarredTab, __assign({}, props)));
    return wrapper;
};
describe('RichHistoryStarredTab', function () {
    describe('sorter', function () {
        it('should render sorter', function () {
            var wrapper = setup();
            expect(wrapper.find({ 'aria-label': 'Sort queries' })).toHaveLength(1);
        });
    });
    describe('select datasource', function () {
        it('should render select datasource if activeDatasourceOnly is false', function () {
            var wrapper = setup();
            expect(wrapper.find({ 'aria-label': 'Filter datasources' })).toHaveLength(1);
        });
        it('should not render select datasource if activeDatasourceOnly is true', function () {
            var wrapper = setup({ activeDatasourceOnly: true });
            expect(wrapper.find({ 'aria-label': 'Filter datasources' })).toHaveLength(0);
        });
    });
});
//# sourceMappingURL=RichHistoryStarredTab.test.js.map