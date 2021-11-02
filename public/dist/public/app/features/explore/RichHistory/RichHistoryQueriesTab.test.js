import { __assign } from "tslib";
import React from 'react';
import { mount } from 'enzyme';
import { ExploreId } from '../../../types/explore';
import { SortOrder } from 'app/core/utils/richHistory';
import { RichHistoryQueriesTab } from './RichHistoryQueriesTab';
import { RangeSlider } from '@grafana/ui';
jest.mock('../state/selectors', function () { return ({ getExploreDatasources: jest.fn() }); });
var setup = function (propOverrides) {
    var props = {
        queries: [],
        sortOrder: SortOrder.Ascending,
        activeDatasourceOnly: false,
        datasourceFilters: [],
        retentionPeriod: 14,
        height: 100,
        exploreId: ExploreId.left,
        onChangeSortOrder: jest.fn(),
        onSelectDatasourceFilters: jest.fn(),
    };
    Object.assign(props, propOverrides);
    var wrapper = mount(React.createElement(RichHistoryQueriesTab, __assign({}, props)));
    return wrapper;
};
describe('RichHistoryQueriesTab', function () {
    describe('slider', function () {
        it('should render slider', function () {
            var wrapper = setup();
            expect(wrapper.find(RangeSlider)).toHaveLength(1);
        });
        it('should render slider with correct timerange', function () {
            var wrapper = setup();
            expect(wrapper.find('.label-slider').at(1).text()).toEqual('today');
            expect(wrapper.find('.label-slider').at(2).text()).toEqual('two weeks ago');
        });
    });
    describe('sort options', function () {
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
//# sourceMappingURL=RichHistoryQueriesTab.test.js.map