import { __awaiter, __generator } from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { CloudWatchLogsQueryField } from './LogsQueryField';
import { ExploreId } from '../../../../types';
// eslint-disable-next-line lodash/import-scope
import _ from 'lodash';
jest
    .spyOn(_, 'debounce')
    .mockImplementation(function (func, wait) { return func; });
describe('CloudWatchLogsQueryField', function () {
    it('updates upstream query log groups on region change', function () { return __awaiter(void 0, void 0, void 0, function () {
        var onChange, wrapper, getRegionSelect, getLogGroupSelect;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    onChange = jest.fn();
                    wrapper = shallow(React.createElement(CloudWatchLogsQueryField, { history: [], absoluteRange: { from: 1, to: 10 }, exploreId: ExploreId.left, datasource: {
                            getRegions: function () {
                                return Promise.resolve([
                                    {
                                        label: 'region1',
                                        value: 'region1',
                                        text: 'region1',
                                    },
                                    {
                                        label: 'region2',
                                        value: 'region2',
                                        text: 'region2',
                                    },
                                ]);
                            },
                            describeLogGroups: function (params) {
                                if (params.region === 'region1') {
                                    return Promise.resolve(['log_group_1']);
                                }
                                else {
                                    return Promise.resolve(['log_group_2']);
                                }
                            },
                        }, query: {}, onRunQuery: function () { }, onChange: onChange }));
                    getRegionSelect = function () { return wrapper.find({ label: 'Region' }).props().inputEl; };
                    getLogGroupSelect = function () { return wrapper.find({ label: 'Log Groups' }).props().inputEl; };
                    getLogGroupSelect().props.onChange([{ value: 'log_group_1' }]);
                    expect(getLogGroupSelect().props.value.length).toBe(1);
                    expect(getLogGroupSelect().props.value[0].value).toBe('log_group_1');
                    // We select new region where the selected log group does not exist
                    return [4 /*yield*/, getRegionSelect().props.onChange({ value: 'region2' })];
                case 1:
                    // We select new region where the selected log group does not exist
                    _a.sent();
                    // We clear the select
                    expect(getLogGroupSelect().props.value.length).toBe(0);
                    // Make sure we correctly updated the upstream state
                    expect(onChange.mock.calls[onChange.mock.calls.length - 1][0]).toEqual({ region: 'region2', logGroupNames: [] });
                    return [2 /*return*/];
            }
        });
    }); });
    it('should merge results of remote log groups search with existing results', function () { return __awaiter(void 0, void 0, void 0, function () {
        var allLogGroups, onChange, wrapper, initialAvailableGroups, nextAvailableGroups;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    allLogGroups = [
                        'AmazingGroup',
                        'AmazingGroup2',
                        'AmazingGroup3',
                        'BeautifulGroup',
                        'BeautifulGroup2',
                        'BeautifulGroup3',
                        'CrazyGroup',
                        'CrazyGroup2',
                        'CrazyGroup3',
                        'DeliciousGroup',
                        'DeliciousGroup2',
                        'DeliciousGroup3',
                        'EnjoyableGroup',
                        'EnjoyableGroup2',
                        'EnjoyableGroup3',
                        'FavouriteGroup',
                        'FavouriteGroup2',
                        'FavouriteGroup3',
                        'GorgeousGroup',
                        'GorgeousGroup2',
                        'GorgeousGroup3',
                        'HappyGroup',
                        'HappyGroup2',
                        'HappyGroup3',
                        'IncredibleGroup',
                        'IncredibleGroup2',
                        'IncredibleGroup3',
                        'JollyGroup',
                        'JollyGroup2',
                        'JollyGroup3',
                        'KoolGroup',
                        'KoolGroup2',
                        'KoolGroup3',
                        'LovelyGroup',
                        'LovelyGroup2',
                        'LovelyGroup3',
                        'MagnificentGroup',
                        'MagnificentGroup2',
                        'MagnificentGroup3',
                        'NiceGroup',
                        'NiceGroup2',
                        'NiceGroup3',
                        'OddGroup',
                        'OddGroup2',
                        'OddGroup3',
                        'PerfectGroup',
                        'PerfectGroup2',
                        'PerfectGroup3',
                        'QuietGroup',
                        'QuietGroup2',
                        'QuietGroup3',
                        'RestlessGroup',
                        'RestlessGroup2',
                        'RestlessGroup3',
                        'SurpriseGroup',
                        'SurpriseGroup2',
                        'SurpriseGroup3',
                        'TestingGroup',
                        'TestingGroup2',
                        'TestingGroup3',
                        'UmbrellaGroup',
                        'UmbrellaGroup2',
                        'UmbrellaGroup3',
                        'VelvetGroup',
                        'VelvetGroup2',
                        'VelvetGroup3',
                        'WaterGroup',
                        'WaterGroup2',
                        'WaterGroup3',
                        'XylophoneGroup',
                        'XylophoneGroup2',
                        'XylophoneGroup3',
                        'YellowGroup',
                        'YellowGroup2',
                        'YellowGroup3',
                        'ZebraGroup',
                        'ZebraGroup2',
                        'ZebraGroup3',
                    ];
                    onChange = jest.fn();
                    wrapper = shallow(React.createElement(CloudWatchLogsQueryField, { history: [], absoluteRange: { from: 1, to: 10 }, exploreId: ExploreId.left, datasource: {
                            getRegions: function () {
                                return Promise.resolve([
                                    {
                                        label: 'region1',
                                        value: 'region1',
                                        text: 'region1',
                                    },
                                    {
                                        label: 'region2',
                                        value: 'region2',
                                        text: 'region2',
                                    },
                                ]);
                            },
                            describeLogGroups: function (params) {
                                var _a;
                                var theLogGroups = allLogGroups
                                    .filter(function (logGroupName) { var _a; return logGroupName.startsWith((_a = params.logGroupNamePrefix) !== null && _a !== void 0 ? _a : ''); })
                                    .slice(0, Math.max((_a = params.limit) !== null && _a !== void 0 ? _a : 50, 50));
                                return Promise.resolve(theLogGroups);
                            },
                        }, query: {}, onRunQuery: function () { }, onChange: onChange }));
                    initialAvailableGroups = allLogGroups
                        .slice(0, 50)
                        .map(function (logGroupName) { return ({ value: logGroupName, label: logGroupName }); });
                    wrapper.setState({
                        availableLogGroups: initialAvailableGroups,
                    });
                    return [4 /*yield*/, wrapper.instance().onLogGroupSearch('Water', 'default', { action: 'input-change' })];
                case 1:
                    _a.sent();
                    nextAvailableGroups = wrapper.state('availableLogGroups').map(function (logGroup) { return logGroup.value; });
                    expect(nextAvailableGroups).toEqual(initialAvailableGroups.map(function (logGroup) { return logGroup.value; }).concat(['WaterGroup', 'WaterGroup2', 'WaterGroup3']));
                    return [4 /*yield*/, wrapper.instance().onLogGroupSearch('Velv', 'default', { action: 'input-change' })];
                case 2:
                    _a.sent();
                    nextAvailableGroups = wrapper.state('availableLogGroups').map(function (logGroup) { return logGroup.value; });
                    expect(nextAvailableGroups).toEqual(initialAvailableGroups
                        .map(function (logGroup) { return logGroup.value; })
                        .concat(['WaterGroup', 'WaterGroup2', 'WaterGroup3', 'VelvetGroup', 'VelvetGroup2', 'VelvetGroup3']));
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=LogsQueryField.test.js.map