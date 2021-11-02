import { __assign } from "tslib";
import React from 'react';
import { noop } from 'lodash';
import { shallow } from 'enzyme';
import { SecondaryActions } from './SecondaryActions';
import { config } from '@grafana/runtime';
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { config: __assign(__assign({}, jest.requireActual('@grafana/runtime').config), { featureToggles: {
            fullRangeLogsVolume: true,
            autoLoadFullRangeLogsVolume: false,
        } }) })); });
var addQueryRowButtonSelector = '[aria-label="Add row button"]';
var richHistoryButtonSelector = '[aria-label="Rich history button"]';
var queryInspectorButtonSelector = '[aria-label="Query inspector button"]';
describe('SecondaryActions', function () {
    it('should render component two buttons', function () {
        var wrapper = shallow(React.createElement(SecondaryActions, { onClickAddQueryRowButton: noop, onClickRichHistoryButton: noop, onClickQueryInspectorButton: noop }));
        expect(wrapper.find(addQueryRowButtonSelector)).toHaveLength(1);
        expect(wrapper.find(richHistoryButtonSelector)).toHaveLength(1);
    });
    it('should not render add row button if addQueryRowButtonHidden=true', function () {
        var wrapper = shallow(React.createElement(SecondaryActions, { addQueryRowButtonHidden: true, onClickAddQueryRowButton: noop, onClickRichHistoryButton: noop, onClickQueryInspectorButton: noop }));
        expect(wrapper.find(addQueryRowButtonSelector)).toHaveLength(0);
        expect(wrapper.find(richHistoryButtonSelector)).toHaveLength(1);
    });
    it('should disable add row button if addQueryRowButtonDisabled=true', function () {
        var wrapper = shallow(React.createElement(SecondaryActions, { addQueryRowButtonDisabled: true, onClickAddQueryRowButton: noop, onClickRichHistoryButton: noop, onClickQueryInspectorButton: noop }));
        expect(wrapper.find(addQueryRowButtonSelector).props().disabled).toBe(true);
    });
    it('should map click handlers correctly', function () {
        var onClickAddRow = jest.fn();
        var onClickHistory = jest.fn();
        var onClickQueryInspector = jest.fn();
        var wrapper = shallow(React.createElement(SecondaryActions, { onClickAddQueryRowButton: onClickAddRow, onClickRichHistoryButton: onClickHistory, onClickQueryInspectorButton: onClickQueryInspector }));
        wrapper.find(addQueryRowButtonSelector).simulate('click');
        expect(onClickAddRow).toBeCalled();
        wrapper.find(richHistoryButtonSelector).simulate('click');
        expect(onClickHistory).toBeCalled();
        wrapper.find(queryInspectorButtonSelector).simulate('click');
        expect(onClickQueryInspector).toBeCalled();
    });
    it('does not render load logs volume button when auto loading is enabled', function () {
        config.featureToggles.autoLoadFullRangeLogsVolume = true;
    });
});
//# sourceMappingURL=SecondaryActions.test.js.map