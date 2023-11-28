import { __awaiter } from "tslib";
import { render, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { byRole, byTestId, byText } from 'testing-library-selector';
import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { AccessControlAction } from 'app/types';
import MuteTimings from './MuteTimings';
import { fetchAlertManagerConfig, updateAlertManagerConfig } from './api/alertmanager';
import { grantUserPermissions, mockDataSource, MockDataSourceSrv } from './mocks';
import { DataSourceType } from './utils/datasource';
jest.mock('./api/alertmanager');
const mocks = {
    api: {
        fetchAlertManagerConfig: jest.mocked(fetchAlertManagerConfig),
        updateAlertManagerConfig: jest.mocked(updateAlertManagerConfig),
    },
};
const renderMuteTimings = (location = '/alerting/routes/mute-timing/new') => {
    locationService.push(location);
    return render(React.createElement(TestProvider, null,
        React.createElement(MuteTimings, null)));
};
const dataSources = {
    am: mockDataSource({
        name: 'Alertmanager',
        type: DataSourceType.Alertmanager,
    }),
};
const ui = {
    form: byTestId('mute-timing-form'),
    nameField: byTestId('mute-timing-name'),
    startsAt: byTestId('mute-timing-starts-at'),
    endsAt: byTestId('mute-timing-ends-at'),
    addTimeRange: byRole('button', { name: /add another time range/i }),
    weekdays: byTestId('mute-timing-weekdays'),
    days: byTestId('mute-timing-days'),
    months: byTestId('mute-timing-months'),
    years: byTestId('mute-timing-years'),
    addInterval: byRole('button', { name: /add another time interval/i }),
    submitButton: byText(/submit/i),
};
const muteTimeInterval = {
    name: 'default-mute',
    time_intervals: [
        {
            times: [
                {
                    start_time: '12:00',
                    end_time: '24:00',
                },
            ],
            days_of_month: ['15', '-1'],
            months: ['august:december', 'march'],
        },
    ],
};
const defaultConfig = {
    alertmanager_config: {
        receivers: [{ name: 'default' }, { name: 'critical' }],
        route: {
            receiver: 'default',
            group_by: ['alertname'],
            routes: [
                {
                    matchers: ['env=prod', 'region!=EU'],
                    mute_time_intervals: [muteTimeInterval.name],
                },
            ],
        },
        templates: [],
        mute_time_intervals: [muteTimeInterval],
    },
    template_files: {},
};
const resetMocks = () => {
    jest.resetAllMocks();
    mocks.api.fetchAlertManagerConfig.mockImplementation(() => {
        return Promise.resolve(Object.assign({}, defaultConfig));
    });
    mocks.api.updateAlertManagerConfig.mockImplementation(() => {
        return Promise.resolve();
    });
};
describe('Mute timings', () => {
    beforeEach(() => {
        setDataSourceSrv(new MockDataSourceSrv(dataSources));
        resetMocks();
        // FIXME: scope down
        grantUserPermissions(Object.values(AccessControlAction));
    });
    it('creates a new mute timing', () => __awaiter(void 0, void 0, void 0, function* () {
        renderMuteTimings();
        yield waitFor(() => expect(mocks.api.fetchAlertManagerConfig).toHaveBeenCalled());
        expect(ui.nameField.get()).toBeInTheDocument();
        yield userEvent.type(ui.nameField.get(), 'maintenance period');
        yield userEvent.type(ui.startsAt.get(), '22:00');
        yield userEvent.type(ui.endsAt.get(), '24:00');
        yield userEvent.type(ui.days.get(), '-1');
        yield userEvent.type(ui.months.get(), 'january, july');
        fireEvent.submit(ui.form.get());
        yield waitFor(() => expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalled());
        expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalledWith('grafana', Object.assign(Object.assign({}, defaultConfig), { alertmanager_config: Object.assign(Object.assign({}, defaultConfig.alertmanager_config), { mute_time_intervals: [
                    muteTimeInterval,
                    {
                        name: 'maintenance period',
                        time_intervals: [
                            {
                                days_of_month: ['-1'],
                                months: ['january', 'july'],
                                times: [
                                    {
                                        start_time: '22:00',
                                        end_time: '24:00',
                                    },
                                ],
                            },
                        ],
                    },
                ] }) }));
    }));
    it('prepopulates the form when editing a mute timing', () => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c;
        renderMuteTimings('/alerting/routes/mute-timing/edit' + `?muteName=${encodeURIComponent(muteTimeInterval.name)}`);
        yield waitFor(() => expect(mocks.api.fetchAlertManagerConfig).toHaveBeenCalled());
        expect(ui.nameField.get()).toBeInTheDocument();
        expect(ui.nameField.get()).toHaveValue(muteTimeInterval.name);
        expect(ui.months.get()).toHaveValue((_a = muteTimeInterval.time_intervals[0].months) === null || _a === void 0 ? void 0 : _a.join(', '));
        yield userEvent.clear((_b = ui.startsAt.getAll()) === null || _b === void 0 ? void 0 : _b[0]);
        yield userEvent.clear((_c = ui.endsAt.getAll()) === null || _c === void 0 ? void 0 : _c[0]);
        yield userEvent.clear(ui.days.get());
        yield userEvent.clear(ui.months.get());
        yield userEvent.clear(ui.years.get());
        const monday = within(ui.weekdays.get()).getByText('Mon');
        yield userEvent.click(monday);
        yield userEvent.type(ui.days.get(), '-7:-1');
        yield userEvent.type(ui.months.get(), '3, 6, 9, 12');
        yield userEvent.type(ui.years.get(), '2021:2024');
        fireEvent.submit(ui.form.get());
        yield waitFor(() => expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalled());
        expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalledWith('grafana', {
            alertmanager_config: {
                receivers: [
                    {
                        name: 'default',
                    },
                    {
                        name: 'critical',
                    },
                ],
                route: {
                    receiver: 'default',
                    group_by: ['alertname'],
                    routes: [
                        {
                            matchers: ['env=prod', 'region!=EU'],
                            mute_time_intervals: ['default-mute'],
                        },
                    ],
                },
                templates: [],
                mute_time_intervals: [
                    {
                        name: 'default-mute',
                        time_intervals: [
                            {
                                times: [],
                                weekdays: ['monday'],
                                days_of_month: ['-7:-1'],
                                months: ['3', '6', '9', '12'],
                                years: ['2021:2024'],
                            },
                        ],
                    },
                ],
            },
            template_files: {},
        });
    }));
    it('form is invalid with duplicate mute timing name', () => __awaiter(void 0, void 0, void 0, function* () {
        renderMuteTimings();
        yield waitFor(() => expect(mocks.api.fetchAlertManagerConfig).toHaveBeenCalled());
        yield waitFor(() => expect(ui.nameField.get()).toBeInTheDocument());
        yield userEvent.type(ui.nameField.get(), 'default-mute');
        yield userEvent.type(ui.days.get(), '1');
        yield waitFor(() => expect(ui.nameField.get()).toHaveValue('default-mute'));
        fireEvent.submit(ui.form.get());
        // Form state should be invalid and prevent firing of update action
        yield waitFor(() => expect(byRole('alert').get()).toBeInTheDocument());
        expect(mocks.api.updateAlertManagerConfig).not.toHaveBeenCalled();
    }));
    it('replaces mute timings in routes when the mute timing name is changed', () => __awaiter(void 0, void 0, void 0, function* () {
        renderMuteTimings('/alerting/routes/mute-timing/edit' + `?muteName=${encodeURIComponent(muteTimeInterval.name)}`);
        yield waitFor(() => expect(mocks.api.fetchAlertManagerConfig).toHaveBeenCalled());
        expect(ui.nameField.get()).toBeInTheDocument();
        expect(ui.nameField.get()).toHaveValue(muteTimeInterval.name);
        yield userEvent.clear(ui.nameField.get());
        yield userEvent.type(ui.nameField.get(), 'Lunch breaks');
        fireEvent.submit(ui.form.get());
        yield waitFor(() => expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalled());
        expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalledWith('grafana', {
            alertmanager_config: {
                receivers: [
                    {
                        name: 'default',
                    },
                    {
                        name: 'critical',
                    },
                ],
                route: {
                    receiver: 'default',
                    group_by: ['alertname'],
                    routes: [
                        {
                            matchers: ['env=prod', 'region!=EU'],
                            mute_time_intervals: ['Lunch breaks'],
                        },
                    ],
                },
                templates: [],
                mute_time_intervals: [
                    {
                        name: 'Lunch breaks',
                        time_intervals: [
                            {
                                times: [
                                    {
                                        start_time: '12:00',
                                        end_time: '24:00',
                                    },
                                ],
                                days_of_month: ['15', '-1'],
                                months: ['august:december', 'march'],
                            },
                        ],
                    },
                ],
            },
            template_files: {},
        });
    }));
});
//# sourceMappingURL=MuteTimings.test.js.map