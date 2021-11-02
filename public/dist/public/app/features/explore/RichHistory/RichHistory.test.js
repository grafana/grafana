import { __assign } from "tslib";
import React from 'react';
import { mount } from 'enzyme';
import { ExploreId } from '../../../types/explore';
import { RichHistory, Tabs } from './RichHistory';
import { Tab } from '@grafana/ui';
jest.mock('../state/selectors', function () { return ({ getExploreDatasources: jest.fn() }); });
var setup = function (propOverrides) {
    var props = {
        theme: {},
        exploreId: ExploreId.left,
        height: 100,
        activeDatasourceInstance: 'Test datasource',
        richHistory: [],
        firstTab: Tabs.RichHistory,
        deleteRichHistory: jest.fn(),
        onClose: jest.fn(),
    };
    Object.assign(props, propOverrides);
    var wrapper = mount(React.createElement(RichHistory, __assign({}, props)));
    return wrapper;
};
describe('RichHistory', function () {
    it('should render all tabs in tab bar', function () {
        var wrapper = setup();
        expect(wrapper.find(Tab)).toHaveLength(3);
    });
    it('should render correct lebels of tabs in tab bar', function () {
        var wrapper = setup();
        expect(wrapper.find(Tab).at(0).text()).toEqual('Query history');
        expect(wrapper.find(Tab).at(1).text()).toEqual('Starred');
        expect(wrapper.find(Tab).at(2).text()).toEqual('Settings');
    });
    it('should correctly render query history tab as active tab', function () {
        var wrapper = setup();
        expect(wrapper.find('RichHistoryQueriesTab')).toHaveLength(1);
    });
    it('should correctly render starred tab as active tab', function () {
        var wrapper = setup({ firstTab: Tabs.Starred });
        expect(wrapper.find('RichHistoryStarredTab')).toHaveLength(1);
    });
});
//# sourceMappingURL=RichHistory.test.js.map