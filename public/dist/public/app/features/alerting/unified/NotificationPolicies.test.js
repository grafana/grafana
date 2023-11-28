import { __awaiter } from "tslib";
import { render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { byLabelText, byRole, byTestId, byText } from 'testing-library-selector';
import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AlertManagerImplementation, MatcherOperator, } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';
import NotificationPolicies, { findRoutesMatchingFilters } from './NotificationPolicies';
import { fetchAlertManagerConfig, fetchStatus, updateAlertManagerConfig } from './api/alertmanager';
import { alertmanagerApi } from './api/alertmanagerApi';
import { discoverAlertmanagerFeatures } from './api/buildInfo';
import * as grafanaApp from './components/receivers/grafanaAppReceivers/grafanaApp';
import { mockDataSource, MockDataSourceSrv, someCloudAlertManagerConfig, someCloudAlertManagerStatus } from './mocks';
import { defaultGroupBy } from './utils/amroutes';
import { getAllDataSources } from './utils/config';
import { ALERTMANAGER_NAME_QUERY_KEY } from './utils/constants';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import 'core-js/stable/structured-clone';
jest.mock('./api/alertmanager');
jest.mock('./utils/config');
jest.mock('app/core/services/context_srv');
jest.mock('./api/buildInfo');
jest.mock('./useRouteGroupsMatcher');
const mocks = {
    getAllDataSourcesMock: jest.mocked(getAllDataSources),
    api: {
        fetchAlertManagerConfig: jest.mocked(fetchAlertManagerConfig),
        updateAlertManagerConfig: jest.mocked(updateAlertManagerConfig),
        fetchStatus: jest.mocked(fetchStatus),
        discoverAlertmanagerFeatures: jest.mocked(discoverAlertmanagerFeatures),
    },
    contextSrv: jest.mocked(contextSrv),
};
const useGetGrafanaReceiverTypeCheckerMock = jest.spyOn(grafanaApp, 'useGetGrafanaReceiverTypeChecker');
const renderNotificationPolicies = (alertManagerSourceName) => {
    locationService.push(location);
    locationService.push('/alerting/routes' + (alertManagerSourceName ? `?${ALERTMANAGER_NAME_QUERY_KEY}=${alertManagerSourceName}` : ''));
    return render(React.createElement(TestProvider, null,
        React.createElement(NotificationPolicies, null)));
};
const dataSources = {
    am: mockDataSource({
        name: 'Alertmanager',
        type: DataSourceType.Alertmanager,
    }),
    promAlertManager: mockDataSource({
        name: 'PromManager',
        type: DataSourceType.Alertmanager,
        jsonData: {
            implementation: AlertManagerImplementation.prometheus,
        },
    }),
};
const ui = {
    rootReceiver: byTestId('am-routes-root-receiver'),
    rootGroupBy: byTestId('am-routes-root-group-by'),
    rootTimings: byTestId('am-routes-root-timings'),
    row: byTestId('am-routes-row'),
    rootRouteContainer: byTestId('am-root-route-container'),
    editButton: byRole('button', { name: 'Edit' }),
    saveButton: byRole('button', { name: 'Save' }),
    setDefaultReceiverCTA: byRole('button', { name: 'Set a default contact point' }),
    editRouteButton: byLabelText('Edit route'),
    deleteRouteButton: byLabelText('Delete route'),
    newPolicyButton: byRole('button', { name: /Add policy/ }),
    newPolicyCTAButton: byRole('button', { name: /Add specific policy/ }),
    savePolicyButton: byRole('button', { name: /save policy/i }),
    receiverSelect: byTestId('am-receiver-select'),
    groupSelect: byTestId('am-group-select'),
    muteTimingSelect: byTestId('am-mute-timing-select'),
    groupWaitContainer: byTestId('am-group-wait'),
    groupIntervalContainer: byTestId('am-group-interval'),
    groupRepeatContainer: byTestId('am-repeat-interval'),
    confirmDeleteModal: byRole('dialog'),
    confirmDeleteButton: byLabelText('Confirm Modal Danger Button'),
};
describe('NotificationPolicies', () => {
    const subroutes = [
        {
            match: {
                sub1matcher1: 'sub1value1',
                sub1matcher2: 'sub1value2',
            },
            match_re: {
                sub1matcher3: 'sub1value3',
                sub1matcher4: 'sub1value4',
            },
            group_by: ['sub1group1', 'sub1group2'],
            receiver: 'a-receiver',
            continue: true,
            group_wait: '3s',
            group_interval: '2m',
            repeat_interval: '1s',
            routes: [
                {
                    match: {
                        sub1sub1matcher1: 'sub1sub1value1',
                        sub1sub1matcher2: 'sub1sub1value2',
                    },
                    match_re: {
                        sub1sub1matcher3: 'sub1sub1value3',
                        sub1sub1matcher4: 'sub1sub1value4',
                    },
                    group_by: ['sub1sub1group1', 'sub1sub1group2'],
                    receiver: 'another-receiver',
                },
                {
                    match: {
                        sub1sub2matcher1: 'sub1sub2value1',
                        sub1sub2matcher2: 'sub1sub2value2',
                    },
                    match_re: {
                        sub1sub2matcher3: 'sub1sub2value3',
                        sub1sub2matcher4: 'sub1sub2value4',
                    },
                    group_by: ['sub1sub2group1', 'sub1sub2group2'],
                    receiver: 'another-receiver',
                },
            ],
        },
        {
            match: {
                sub2matcher1: 'sub2value1',
                sub2matcher2: 'sub2value2',
            },
            match_re: {
                sub2matcher3: 'sub2value3',
                sub2matcher4: 'sub2value4',
            },
            receiver: 'another-receiver',
        },
    ];
    const emptyRoute = {};
    const simpleRoute = {
        receiver: 'simple-receiver',
        matchers: ['hello=world', 'foo!=bar'],
    };
    const rootRoute = {
        receiver: 'default-receiver',
        group_by: ['a-group', 'another-group'],
        group_wait: '1s',
        group_interval: '2m',
        repeat_interval: '3d',
        routes: subroutes,
    };
    const muteInterval = {
        name: 'default-mute',
        time_intervals: [
            {
                times: [{ start_time: '12:00', end_time: '24:00' }],
                weekdays: ['monday:friday'],
                days_of_month: ['1:7', '-1:-7'],
                months: ['january:june'],
                years: ['2020:2022'],
            },
        ],
    };
    beforeEach(() => {
        mocks.getAllDataSourcesMock.mockReturnValue(Object.values(dataSources));
        mocks.contextSrv.hasPermission.mockImplementation(() => true);
        mocks.contextSrv.evaluatePermission.mockImplementation(() => []);
        mocks.api.discoverAlertmanagerFeatures.mockResolvedValue({ lazyConfigInit: false });
        setDataSourceSrv(new MockDataSourceSrv(dataSources));
        useGetGrafanaReceiverTypeCheckerMock.mockReturnValue(() => undefined);
    });
    afterEach(() => {
        jest.resetAllMocks();
        setDataSourceSrv(undefined);
    });
    it.skip('loads and shows routes', () => __awaiter(void 0, void 0, void 0, function* () {
        mocks.api.fetchAlertManagerConfig.mockResolvedValue({
            alertmanager_config: {
                route: rootRoute,
                receivers: [
                    {
                        name: 'default-receiver',
                    },
                    {
                        name: 'a-receiver',
                    },
                    {
                        name: 'another-receiver',
                    },
                ],
            },
            template_files: {},
        });
        yield renderNotificationPolicies();
        yield waitFor(() => expect(mocks.api.fetchAlertManagerConfig).toHaveBeenCalledTimes(1));
        expect(ui.rootReceiver.get()).toHaveTextContent(rootRoute.receiver);
        expect(ui.rootGroupBy.get()).toHaveTextContent(rootRoute.group_by.join(', '));
        const rootTimings = ui.rootTimings.get();
        expect(rootTimings).toHaveTextContent(rootRoute.group_wait);
        expect(rootTimings).toHaveTextContent(rootRoute.group_interval);
        expect(rootTimings).toHaveTextContent(rootRoute.repeat_interval);
        const rows = yield ui.row.findAll();
        expect(rows).toHaveLength(2);
        subroutes.forEach((route, index) => {
            var _a, _b;
            Object.entries((_a = route.match) !== null && _a !== void 0 ? _a : {}).forEach(([label, value]) => {
                expect(rows[index]).toHaveTextContent(`${label}=${value}`);
            });
            Object.entries((_b = route.match_re) !== null && _b !== void 0 ? _b : {}).forEach(([label, value]) => {
                expect(rows[index]).toHaveTextContent(`${label}=~${value}`);
            });
            if (route.group_by) {
                expect(rows[index]).toHaveTextContent(route.group_by.join(', '));
            }
            if (route.receiver) {
                expect(rows[index]).toHaveTextContent(route.receiver);
            }
        });
    }));
    it.skip('can edit root route if one is already defined', () => __awaiter(void 0, void 0, void 0, function* () {
        const defaultConfig = {
            alertmanager_config: {
                receivers: [{ name: 'default' }, { name: 'critical' }],
                route: {
                    receiver: 'default',
                    group_by: ['alertname'],
                },
                templates: [],
            },
            template_files: {},
        };
        const currentConfig = { current: defaultConfig };
        mocks.api.updateAlertManagerConfig.mockImplementation((amSourceName, newConfig) => {
            currentConfig.current = newConfig;
            return Promise.resolve();
        });
        mocks.api.fetchAlertManagerConfig.mockImplementation(() => {
            return Promise.resolve(currentConfig.current);
        });
        yield renderNotificationPolicies();
        expect(yield ui.rootReceiver.find()).toHaveTextContent('default');
        expect(ui.rootGroupBy.get()).toHaveTextContent('alertname');
        // open root route for editing
        const rootRouteContainer = yield ui.rootRouteContainer.find();
        yield userEvent.click(ui.editButton.get(rootRouteContainer));
        // configure receiver & group by
        const receiverSelect = yield ui.receiverSelect.find();
        yield clickSelectOption(receiverSelect, 'critical');
        const groupSelect = ui.groupSelect.get();
        yield userEvent.type(byRole('combobox').get(groupSelect), 'namespace{enter}');
        // configure timing intervals
        yield userEvent.click(byText('Timing options').get(rootRouteContainer));
        yield updateTiming(ui.groupWaitContainer.get(), '1', 'Minutes');
        yield updateTiming(ui.groupIntervalContainer.get(), '4', 'Minutes');
        yield updateTiming(ui.groupRepeatContainer.get(), '5', 'Hours');
        //save
        yield userEvent.click(ui.saveButton.get(rootRouteContainer));
        // wait for it to go out of edit mode
        yield waitFor(() => expect(ui.editButton.query(rootRouteContainer)).not.toBeInTheDocument());
        // check that appropriate api calls were made
        expect(mocks.api.fetchAlertManagerConfig).toHaveBeenCalledTimes(3);
        expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalledTimes(1);
        expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalledWith(GRAFANA_RULES_SOURCE_NAME, {
            alertmanager_config: {
                receivers: [{ name: 'default' }, { name: 'critical' }],
                route: {
                    continue: false,
                    group_by: ['alertname', 'namespace'],
                    receiver: 'critical',
                    routes: [],
                    group_interval: '4m',
                    group_wait: '1m',
                    repeat_interval: '5h',
                    mute_time_intervals: [],
                },
                templates: [],
            },
            template_files: {},
        });
        // check that new config values are rendered
        yield waitFor(() => expect(ui.rootReceiver.query()).toHaveTextContent('critical'));
        expect(ui.rootGroupBy.get()).toHaveTextContent('alertname, namespace');
    }));
    it.skip('can edit root route if one is not defined yet', () => __awaiter(void 0, void 0, void 0, function* () {
        mocks.api.fetchAlertManagerConfig.mockResolvedValue({
            alertmanager_config: {
                receivers: [{ name: 'default' }],
            },
            template_files: {},
        });
        yield renderNotificationPolicies();
        // open root route for editing
        const rootRouteContainer = yield ui.rootRouteContainer.find();
        yield userEvent.click(ui.editButton.get(rootRouteContainer));
        // configure receiver & group by
        const receiverSelect = yield ui.receiverSelect.find();
        yield clickSelectOption(receiverSelect, 'default');
        const groupSelect = ui.groupSelect.get();
        yield userEvent.type(byRole('combobox').get(groupSelect), 'severity{enter}');
        yield userEvent.type(byRole('combobox').get(groupSelect), 'namespace{enter}');
        //save
        yield userEvent.click(ui.saveButton.get(rootRouteContainer));
        // wait for it to go out of edit mode
        yield waitFor(() => expect(ui.editButton.query(rootRouteContainer)).not.toBeInTheDocument());
        // check that appropriate api calls were made
        expect(mocks.api.fetchAlertManagerConfig).toHaveBeenCalledTimes(3);
        expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalledTimes(1);
        expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalledWith(GRAFANA_RULES_SOURCE_NAME, {
            alertmanager_config: {
                receivers: [{ name: 'default' }],
                route: {
                    continue: false,
                    group_by: defaultGroupBy.concat(['severity', 'namespace']),
                    receiver: 'default',
                    routes: [],
                    mute_time_intervals: [],
                },
            },
            template_files: {},
        });
    }));
    it('hides create and edit button if user does not have permission', () => __awaiter(void 0, void 0, void 0, function* () {
        mocks.contextSrv.hasPermission.mockImplementation((action) => [AccessControlAction.AlertingNotificationsRead, AccessControlAction.AlertingNotificationsRead].includes(action));
        renderNotificationPolicies();
        yield waitFor(() => expect(mocks.api.fetchAlertManagerConfig).toHaveBeenCalledTimes(1));
        expect(ui.newPolicyButton.query()).not.toBeInTheDocument();
        expect(ui.editButton.query()).not.toBeInTheDocument();
    }));
    it('Show error message if loading Alertmanager config fails', () => __awaiter(void 0, void 0, void 0, function* () {
        mocks.api.fetchAlertManagerConfig.mockRejectedValue({
            status: 500,
            data: {
                message: "Alertmanager has exploded. it's gone. Forget about it.",
            },
        });
        jest.spyOn(alertmanagerApi, 'useGetAlertmanagerAlertGroupsQuery').mockImplementation(() => ({
            currentData: [],
            refetch: jest.fn(),
        }));
        yield renderNotificationPolicies();
        yield waitFor(() => expect(mocks.api.fetchAlertManagerConfig).toHaveBeenCalledTimes(1));
        expect(yield byText("Alertmanager has exploded. it's gone. Forget about it.").find()).toBeInTheDocument();
        expect(ui.rootReceiver.query()).not.toBeInTheDocument();
        expect(ui.editButton.query()).not.toBeInTheDocument();
    }));
    it.skip('Converts matchers to object_matchers for grafana alertmanager', () => __awaiter(void 0, void 0, void 0, function* () {
        const defaultConfig = {
            alertmanager_config: {
                receivers: [{ name: 'default' }, { name: 'critical' }],
                route: {
                    continue: false,
                    receiver: 'default',
                    group_by: ['alertname'],
                    routes: [simpleRoute],
                    group_interval: '4m',
                    group_wait: '1m',
                    repeat_interval: '5h',
                },
                templates: [],
            },
            template_files: {},
        };
        const currentConfig = { current: defaultConfig };
        mocks.api.updateAlertManagerConfig.mockImplementation((amSourceName, newConfig) => {
            currentConfig.current = newConfig;
            return Promise.resolve();
        });
        mocks.api.fetchAlertManagerConfig.mockImplementation(() => {
            return Promise.resolve(currentConfig.current);
        });
        yield renderNotificationPolicies(GRAFANA_RULES_SOURCE_NAME);
        expect(yield ui.rootReceiver.find()).toHaveTextContent('default');
        expect(mocks.api.fetchAlertManagerConfig).toHaveBeenCalled();
        // Toggle a save to test new object_matchers
        const rootRouteContainer = yield ui.rootRouteContainer.find();
        yield userEvent.click(ui.editButton.get(rootRouteContainer));
        yield userEvent.click(ui.saveButton.get(rootRouteContainer));
        yield waitFor(() => expect(ui.editButton.query(rootRouteContainer)).not.toBeInTheDocument());
        expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalled();
        expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalledWith(GRAFANA_RULES_SOURCE_NAME, {
            alertmanager_config: {
                receivers: [{ name: 'default' }, { name: 'critical' }],
                route: {
                    continue: false,
                    group_by: ['alertname'],
                    group_interval: '4m',
                    group_wait: '1m',
                    receiver: 'default',
                    repeat_interval: '5h',
                    mute_time_intervals: [],
                    routes: [
                        {
                            continue: false,
                            group_by: [],
                            object_matchers: [
                                ['hello', '=', 'world'],
                                ['foo', '!=', 'bar'],
                            ],
                            receiver: 'simple-receiver',
                            mute_time_intervals: [],
                            routes: [],
                        },
                    ],
                },
                templates: [],
            },
            template_files: {},
        });
    }));
    it.skip('Should be able to delete an empty route', () => __awaiter(void 0, void 0, void 0, function* () {
        const routeConfig = {
            continue: false,
            receiver: 'default',
            group_by: ['alertname'],
            routes: [emptyRoute],
            group_interval: '4m',
            group_wait: '1m',
            repeat_interval: '5h',
            mute_time_intervals: [],
        };
        const defaultConfig = {
            alertmanager_config: {
                receivers: [{ name: 'default' }, { name: 'critical' }],
                route: routeConfig,
                templates: [],
            },
            template_files: {},
        };
        mocks.api.fetchAlertManagerConfig.mockImplementation(() => {
            return Promise.resolve(defaultConfig);
        });
        mocks.api.updateAlertManagerConfig.mockResolvedValue(Promise.resolve());
        yield renderNotificationPolicies(GRAFANA_RULES_SOURCE_NAME);
        yield waitFor(() => expect(mocks.api.fetchAlertManagerConfig).toHaveBeenCalled());
        const deleteButtons = yield ui.deleteRouteButton.findAll();
        expect(deleteButtons).toHaveLength(1);
        yield userEvent.click(deleteButtons[0]);
        const confirmDeleteButton = ui.confirmDeleteButton.get(ui.confirmDeleteModal.get());
        expect(confirmDeleteButton).toBeInTheDocument();
        yield userEvent.click(confirmDeleteButton);
        expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalledWith(GRAFANA_RULES_SOURCE_NAME, Object.assign(Object.assign({}, defaultConfig), { alertmanager_config: Object.assign(Object.assign({}, defaultConfig.alertmanager_config), { route: Object.assign(Object.assign({}, routeConfig), { routes: [] }) }) }));
    }));
    it.skip('Keeps matchers for non-grafana alertmanager sources', () => __awaiter(void 0, void 0, void 0, function* () {
        const defaultConfig = {
            alertmanager_config: {
                receivers: [{ name: 'default' }, { name: 'critical' }],
                route: {
                    continue: false,
                    receiver: 'default',
                    group_by: ['alertname'],
                    routes: [simpleRoute],
                    group_interval: '4m',
                    group_wait: '1m',
                    repeat_interval: '5h',
                },
                templates: [],
            },
            template_files: {},
        };
        const currentConfig = { current: defaultConfig };
        mocks.api.updateAlertManagerConfig.mockImplementation((amSourceName, newConfig) => {
            currentConfig.current = newConfig;
            return Promise.resolve();
        });
        mocks.api.fetchAlertManagerConfig.mockImplementation(() => {
            return Promise.resolve(currentConfig.current);
        });
        yield renderNotificationPolicies(dataSources.am.name);
        expect(yield ui.rootReceiver.find()).toHaveTextContent('default');
        expect(mocks.api.fetchAlertManagerConfig).toHaveBeenCalled();
        // Toggle a save to test new object_matchers
        const rootRouteContainer = yield ui.rootRouteContainer.find();
        yield userEvent.click(ui.editButton.get(rootRouteContainer));
        yield userEvent.click(ui.saveButton.get(rootRouteContainer));
        yield waitFor(() => expect(ui.editButton.query(rootRouteContainer)).not.toBeInTheDocument());
        expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalled();
        expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalledWith(dataSources.am.name, {
            alertmanager_config: {
                receivers: [{ name: 'default' }, { name: 'critical' }],
                route: {
                    continue: false,
                    group_by: ['alertname'],
                    group_interval: '4m',
                    group_wait: '1m',
                    matchers: [],
                    receiver: 'default',
                    repeat_interval: '5h',
                    mute_time_intervals: [],
                    routes: [
                        {
                            continue: false,
                            group_by: [],
                            matchers: ['hello=world', 'foo!=bar'],
                            receiver: 'simple-receiver',
                            routes: [],
                            mute_time_intervals: [],
                        },
                    ],
                },
                templates: [],
            },
            template_files: {},
        });
    }));
    it.skip('Prometheus Alertmanager routes cannot be edited', () => __awaiter(void 0, void 0, void 0, function* () {
        mocks.api.fetchStatus.mockResolvedValue(Object.assign(Object.assign({}, someCloudAlertManagerStatus), { config: someCloudAlertManagerConfig.alertmanager_config }));
        yield renderNotificationPolicies(dataSources.promAlertManager.name);
        const rootRouteContainer = yield ui.rootRouteContainer.find();
        expect(ui.editButton.query(rootRouteContainer)).not.toBeInTheDocument();
        const rows = yield ui.row.findAll();
        expect(rows).toHaveLength(2);
        expect(ui.editRouteButton.query()).not.toBeInTheDocument();
        expect(ui.deleteRouteButton.query()).not.toBeInTheDocument();
        expect(ui.saveButton.query()).not.toBeInTheDocument();
        expect(mocks.api.fetchAlertManagerConfig).not.toHaveBeenCalled();
        expect(mocks.api.fetchStatus).toHaveBeenCalledTimes(1);
    }));
    it('Prometheus Alertmanager has no CTA button if there are no specific policies', () => __awaiter(void 0, void 0, void 0, function* () {
        mocks.api.fetchStatus.mockResolvedValue(Object.assign(Object.assign({}, someCloudAlertManagerStatus), { config: Object.assign(Object.assign({}, someCloudAlertManagerConfig.alertmanager_config), { route: Object.assign(Object.assign({}, someCloudAlertManagerConfig.alertmanager_config.route), { routes: undefined }) }) }));
        jest.spyOn(alertmanagerApi, 'useGetAlertmanagerAlertGroupsQuery').mockImplementation(() => ({
            currentData: [],
            refetch: jest.fn(),
        }));
        yield renderNotificationPolicies(dataSources.promAlertManager.name);
        const rootRouteContainer = yield ui.rootRouteContainer.find();
        yield waitFor(() => expect(within(rootRouteContainer).getByTestId('matching-instances')).toHaveTextContent('0instances'));
        expect(ui.editButton.query(rootRouteContainer)).not.toBeInTheDocument();
        expect(ui.newPolicyCTAButton.query()).not.toBeInTheDocument();
        expect(mocks.api.fetchAlertManagerConfig).not.toHaveBeenCalled();
        expect(mocks.api.fetchStatus).toHaveBeenCalledTimes(1);
    }));
    it.skip('Can add a mute timing to a route', () => __awaiter(void 0, void 0, void 0, function* () {
        const defaultConfig = {
            alertmanager_config: {
                receivers: [{ name: 'default' }, { name: 'critical' }],
                route: {
                    continue: false,
                    receiver: 'default',
                    group_by: ['alertname'],
                    routes: [simpleRoute],
                    group_interval: '4m',
                    group_wait: '1m',
                    repeat_interval: '5h',
                },
                templates: [],
                mute_time_intervals: [muteInterval],
            },
            template_files: {},
        };
        const currentConfig = { current: defaultConfig };
        mocks.api.updateAlertManagerConfig.mockImplementation((amSourceName, newConfig) => {
            currentConfig.current = newConfig;
            return Promise.resolve();
        });
        mocks.api.fetchAlertManagerConfig.mockResolvedValue(defaultConfig);
        yield renderNotificationPolicies(dataSources.am.name);
        const rows = yield ui.row.findAll();
        expect(rows).toHaveLength(1);
        yield userEvent.click(ui.editRouteButton.get(rows[0]));
        const muteTimingSelect = ui.muteTimingSelect.get();
        yield clickSelectOption(muteTimingSelect, 'default-mute');
        expect(muteTimingSelect).toHaveTextContent('default-mute');
        const savePolicyButton = ui.savePolicyButton.get();
        expect(savePolicyButton).toBeInTheDocument();
        yield userEvent.click(savePolicyButton);
        yield waitFor(() => expect(savePolicyButton).not.toBeInTheDocument());
        expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalled();
        expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalledWith(dataSources.am.name, Object.assign(Object.assign({}, defaultConfig), { alertmanager_config: Object.assign(Object.assign({}, defaultConfig.alertmanager_config), { route: Object.assign(Object.assign({}, defaultConfig.alertmanager_config.route), { mute_time_intervals: [], matchers: [], routes: [
                        Object.assign(Object.assign({}, simpleRoute), { mute_time_intervals: [muteInterval.name], routes: [], continue: false, group_by: [] }),
                    ] }) }) }));
    }));
    it.skip('Shows an empty config when config returns an error and the AM supports lazy config initialization', () => __awaiter(void 0, void 0, void 0, function* () {
        mocks.api.discoverAlertmanagerFeatures.mockResolvedValue({ lazyConfigInit: true });
        mocks.api.fetchAlertManagerConfig.mockRejectedValue({
            message: 'alertmanager storage object not found',
        });
        yield renderNotificationPolicies();
        yield waitFor(() => expect(mocks.api.fetchAlertManagerConfig).toHaveBeenCalledTimes(1));
        expect(ui.rootReceiver.query()).toBeInTheDocument();
        expect(ui.setDefaultReceiverCTA.query()).toBeInTheDocument();
    }));
});
describe('findRoutesMatchingFilters', () => {
    const simpleRouteTree = {
        id: '0',
        receiver: 'default-receiver',
        routes: [
            {
                id: '1',
                receiver: 'simple-receiver',
                matchers: ['hello=world', 'foo!=bar'],
                routes: [
                    {
                        id: '2',
                        matchers: ['bar=baz'],
                    },
                ],
            },
        ],
    };
    it('should not match non-existing', () => {
        expect(findRoutesMatchingFilters(simpleRouteTree, {
            labelMatchersFilter: [['foo', MatcherOperator.equal, 'bar']],
        })).toHaveLength(0);
        expect(findRoutesMatchingFilters(simpleRouteTree, {
            contactPointFilter: 'does-not-exist',
        })).toHaveLength(0);
    });
    it('should work with only label matchers', () => {
        const matchingRoutes = findRoutesMatchingFilters(simpleRouteTree, {
            labelMatchersFilter: [['hello', MatcherOperator.equal, 'world']],
        });
        expect(matchingRoutes).toHaveLength(1);
        expect(matchingRoutes[0]).toHaveProperty('id', '1');
    });
    it('should work with only contact point and inheritance', () => {
        const matchingRoutes = findRoutesMatchingFilters(simpleRouteTree, {
            contactPointFilter: 'simple-receiver',
        });
        expect(matchingRoutes).toHaveLength(2);
        expect(matchingRoutes[0]).toHaveProperty('id', '1');
        expect(matchingRoutes[1]).toHaveProperty('id', '2');
    });
    it('should work with non-intersecting filters', () => {
        const matchingRoutes = findRoutesMatchingFilters(simpleRouteTree, {
            labelMatchersFilter: [['hello', MatcherOperator.equal, 'world']],
            contactPointFilter: 'does-not-exist',
        });
        expect(matchingRoutes).toHaveLength(0);
    });
    it('should work with all filters', () => {
        const matchingRoutes = findRoutesMatchingFilters(simpleRouteTree, {
            labelMatchersFilter: [['hello', MatcherOperator.equal, 'world']],
            contactPointFilter: 'simple-receiver',
        });
        expect(matchingRoutes).toHaveLength(1);
        expect(matchingRoutes[0]).toHaveProperty('id', '1');
    });
});
const clickSelectOption = (selectElement, optionText) => __awaiter(void 0, void 0, void 0, function* () {
    yield userEvent.click(byRole('combobox').get(selectElement));
    yield selectOptionInTest(selectElement, optionText);
});
const updateTiming = (selectElement, value, timeUnit) => __awaiter(void 0, void 0, void 0, function* () {
    const input = byRole('textbox').get(selectElement);
    const select = byRole('combobox').get(selectElement);
    yield userEvent.clear(input);
    yield userEvent.type(input, value);
    yield userEvent.click(select);
    yield selectOptionInTest(selectElement, timeUnit);
});
//# sourceMappingURL=NotificationPolicies.test.js.map