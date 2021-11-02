import { __assign } from "tslib";
import React from 'react';
import { mount } from 'enzyme';
import { Resizable } from 're-resizable';
import { ExploreId } from '../../../types/explore';
import { RichHistoryContainer } from './RichHistoryContainer';
import { Tabs } from './RichHistory';
jest.mock('../state/selectors', function () { return ({ getExploreDatasources: jest.fn() }); });
var setup = function (propOverrides) {
    var props = {
        width: 500,
        exploreId: ExploreId.left,
        activeDatasourceInstance: 'Test datasource',
        richHistory: [],
        firstTab: Tabs.RichHistory,
        deleteRichHistory: jest.fn(),
        onClose: jest.fn(),
    };
    Object.assign(props, propOverrides);
    var wrapper = mount(React.createElement(RichHistoryContainer, __assign({}, props)));
    return wrapper;
};
describe('RichHistoryContainer', function () {
    it('should render reseizable component', function () {
        var wrapper = setup();
        expect(wrapper.find(Resizable)).toHaveLength(1);
    });
    it('should render component with correct width', function () {
        var wrapper = setup();
        expect(wrapper.getDOMNode().getAttribute('style')).toContain('width: 531.5px');
    });
    it('should render component with correct height', function () {
        var wrapper = setup();
        expect(wrapper.getDOMNode().getAttribute('style')).toContain('height: 400px');
    });
});
//# sourceMappingURL=RichHistoryContainer.test.js.map