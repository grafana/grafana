import { __assign } from "tslib";
import React from 'react';
import { mount } from 'enzyme';
import { RichHistorySettings } from './RichHistorySettings';
import { Select, Switch } from '@grafana/ui';
var setup = function (propOverrides) {
    var props = {
        retentionPeriod: 14,
        starredTabAsFirstTab: true,
        activeDatasourceOnly: false,
        onChangeRetentionPeriod: jest.fn(),
        toggleStarredTabAsFirstTab: jest.fn(),
        toggleactiveDatasourceOnly: jest.fn(),
        deleteRichHistory: jest.fn(),
    };
    Object.assign(props, propOverrides);
    var wrapper = mount(React.createElement(RichHistorySettings, __assign({}, props)));
    return wrapper;
};
describe('RichHistorySettings', function () {
    it('should render component with correct retention period', function () {
        var wrapper = setup();
        expect(wrapper.find(Select).text()).toEqual('2 weeks');
    });
    it('should render component with correctly checked starredTabAsFirstTab settings', function () {
        var wrapper = setup();
        expect(wrapper.find(Switch).at(0).prop('value')).toBe(true);
    });
    it('should render component with correctly not checked toggleactiveDatasourceOnly settings', function () {
        var wrapper = setup();
        expect(wrapper.find(Switch).at(1).prop('value')).toBe(false);
    });
});
//# sourceMappingURL=RichHistorySettings.test.js.map