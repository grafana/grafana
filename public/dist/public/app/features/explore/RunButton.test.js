import { __assign } from "tslib";
import React from 'react';
import { RunButton } from './RunButton';
import { RefreshPicker } from '@grafana/ui';
import { shallow } from 'enzyme';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
var setup = function (propOverrides) {
    var props = {
        isSmall: false,
        loading: false,
        isLive: false,
        onRun: jest.fn(),
        refreshInterval: '5m',
        onChangeRefreshInterval: jest.fn(),
        showDropdown: false,
    };
    Object.assign(props, propOverrides);
    var wrapper = shallow(React.createElement(RunButton, __assign({}, props)));
    return wrapper;
};
var validIntervals = ['1d'];
jest.mock('app/features/dashboard/services/TimeSrv', function () { return ({
    getTimeSrv: jest.fn().mockReturnValue({
        getValidIntervals: function (intervals) {
            return validIntervals;
        },
    }),
}); });
var getTimeSrvMock = getTimeSrv;
beforeEach(function () {
    getTimeSrvMock.mockClear();
});
describe('RunButton', function () {
    describe('if showdropdown is set', function () {
        it('should render a RefreshPicker with only valid intervals', function () {
            var wrapper = setup({ showDropdown: true });
            expect(wrapper.find(RefreshPicker)).toHaveLength(1);
            expect(wrapper.find(RefreshPicker).props().intervals).toEqual(validIntervals);
        });
    });
});
//# sourceMappingURL=RunButton.test.js.map