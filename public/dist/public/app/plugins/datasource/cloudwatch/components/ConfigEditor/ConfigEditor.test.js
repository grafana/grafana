import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { AwsAuthType } from '@grafana/aws-sdk';
import { PluginContextProvider, PluginType } from '@grafana/data';
import { configureStore } from 'app/store/configureStore';
import { CloudWatchSettings, setupMockedDataSource } from '../../__mocks__/CloudWatchDataSource';
import { CloudWatchDatasource } from '../../datasource';
import { ConfigEditor } from './ConfigEditor';
const datasource = new CloudWatchDatasource(CloudWatchSettings);
const loadDataSourceMock = jest.fn();
jest.mock('app/features/plugins/datasource_srv', () => ({
    getDatasourceSrv: () => ({
        loadDatasource: loadDataSourceMock,
    }),
}));
jest.mock('./XrayLinkConfig', () => ({
    XrayLinkConfig: () => React.createElement(React.Fragment, null),
}));
const putMock = jest.fn();
const getMock = jest.fn();
const mockAppEvents = {
    subscribe: () => ({ unsubscribe: jest.fn() }),
};
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => ({
        put: putMock,
        get: getMock,
    }), getAppEvents: () => mockAppEvents, config: Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime').config), { awsAssumeRoleEnabled: true, featureToggles: {
            cloudWatchCrossAccountQuerying: true,
        } }) })));
const props = {
    options: {
        id: 1,
        uid: 'z',
        orgId: 1,
        typeLogoUrl: '',
        name: 'CloudWatch',
        access: 'proxy',
        url: '',
        database: '',
        type: 'cloudwatch',
        typeName: 'Cloudwatch',
        user: '',
        basicAuth: false,
        basicAuthUser: '',
        isDefault: true,
        readOnly: false,
        withCredentials: false,
        version: 2,
        secureJsonFields: {
            accessKey: false,
            secretKey: false,
        },
        jsonData: {
            assumeRoleArn: '',
            externalId: '',
            database: '',
            customMetricsNamespaces: '',
            authType: AwsAuthType.Keys,
            defaultRegion: 'us-east-2',
            timeField: '@timestamp',
        },
        secureJsonData: {
            secretKey: '',
            accessKey: '',
        },
    },
    onOptionsChange: jest.fn(),
};
const setup = (optionOverrides) => {
    const store = configureStore();
    const newProps = Object.assign(Object.assign({}, props), { options: Object.assign(Object.assign({}, props.options), optionOverrides) });
    const meta = Object.assign(Object.assign({}, newProps.options), { id: 'cloudwatch', type: PluginType.datasource, info: {}, module: '', baseUrl: '' });
    return render(React.createElement(PluginContextProvider, { meta: meta },
        React.createElement(Provider, { store: store },
            React.createElement(ConfigEditor, Object.assign({}, newProps)))));
};
describe('Render', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        putMock.mockImplementation(() => __awaiter(void 0, void 0, void 0, function* () { return ({ datasource: setupMockedDataSource().datasource }); }));
        getMock.mockImplementation(() => __awaiter(void 0, void 0, void 0, function* () { return ({ datasource: setupMockedDataSource().datasource }); }));
        loadDataSourceMock.mockResolvedValue(datasource);
        datasource.resources.getRegions = jest.fn().mockResolvedValue([
            {
                label: 'ap-east-1',
                value: 'ap-east-1',
            },
        ]);
        datasource.getActualRegion = jest.fn().mockReturnValue('ap-east-1');
        datasource.getVariables = jest.fn().mockReturnValue([]);
    });
    it('it should disable access key id field when the datasource has been previously configured', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({
            secureJsonFields: {
                secretKey: true,
            },
        });
        yield waitFor(() => __awaiter(void 0, void 0, void 0, function* () { return expect(screen.getByPlaceholderText('Configured')).toBeDisabled(); }));
    }));
    it('should show credentials profile name field', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({
            jsonData: {
                authType: AwsAuthType.Credentials,
            },
        });
        yield waitFor(() => __awaiter(void 0, void 0, void 0, function* () { return expect(screen.getByLabelText('Credentials Profile Name')).toBeInTheDocument(); }));
    }));
    it('should show access key and secret access key fields when the datasource has not been configured before', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({
            jsonData: {
                authType: AwsAuthType.Keys,
            },
        });
        yield waitFor(() => __awaiter(void 0, void 0, void 0, function* () {
            expect(screen.getByLabelText('Access Key ID')).toBeInTheDocument();
            expect(screen.getByLabelText('Secret Access Key')).toBeInTheDocument();
        }));
    }));
    it('should show arn role field', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({
            jsonData: {
                authType: AwsAuthType.ARN,
            },
        });
        yield waitFor(() => __awaiter(void 0, void 0, void 0, function* () { return expect(screen.getByLabelText('Assume Role ARN')).toBeInTheDocument(); }));
    }));
    it('should display log group selector field', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        yield waitFor(() => __awaiter(void 0, void 0, void 0, function* () { return expect(screen.getByText('Select log groups')).toBeInTheDocument(); }));
    }));
    it('should only display the first two default log groups and show all of them when clicking "Show all" button', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({
            version: 2,
            jsonData: {
                logGroups: [
                    { arn: 'arn:aws:logs:us-east-2:123456789012:log-group:logGroup-foo:*', name: 'logGroup-foo' },
                    { arn: 'arn:aws:logs:us-east-2:123456789012:log-group:logGroup-bar:*', name: 'logGroup-bar' },
                    { arn: 'arn:aws:logs:us-east-2:123456789012:log-group:logGroup-baz:*', name: 'logGroup-baz' },
                ],
            },
        });
        yield waitFor(() => __awaiter(void 0, void 0, void 0, function* () {
            expect(yield screen.getByText('logGroup-foo')).toBeInTheDocument();
            expect(yield screen.getByText('logGroup-bar')).toBeInTheDocument();
            expect(yield screen.queryByText('logGroup-baz')).not.toBeInTheDocument();
            yield userEvent.click(screen.getByText('Show all'));
            expect(yield screen.getByText('logGroup-baz')).toBeInTheDocument();
        }));
    }));
    it('should load the data source if it was saved before', () => __awaiter(void 0, void 0, void 0, function* () {
        const SAVED_VERSION = 2;
        setup({ version: SAVED_VERSION });
        yield waitFor(() => __awaiter(void 0, void 0, void 0, function* () { return expect(loadDataSourceMock).toHaveBeenCalled(); }));
    }));
    it('should not load the data source if it wasnt saved before', () => __awaiter(void 0, void 0, void 0, function* () {
        const SAVED_VERSION = undefined;
        setup({ version: SAVED_VERSION });
        yield waitFor(() => __awaiter(void 0, void 0, void 0, function* () { return expect(loadDataSourceMock).not.toHaveBeenCalled(); }));
    }));
    it('should show error message if Select log group button is clicked when data source is never saved', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({ version: 1 });
        yield waitFor(() => expect(screen.getByText('Select log groups')).toBeInTheDocument());
        yield userEvent.click(screen.getByText('Select log groups'));
        yield waitFor(() => expect(screen.getByText('You need to save the data source before adding log groups.')).toBeInTheDocument());
    }));
    it('should show error message if Select log group button is clicked when data source is saved before but have unsaved changes', () => __awaiter(void 0, void 0, void 0, function* () {
        const SAVED_VERSION = 3;
        const newProps = Object.assign(Object.assign({}, props), { options: Object.assign(Object.assign({}, props.options), { version: SAVED_VERSION }) });
        const meta = Object.assign(Object.assign({}, newProps.options), { id: 'cloudwatch', type: PluginType.datasource, info: {}, module: '', baseUrl: '' });
        const { rerender } = render(React.createElement(PluginContextProvider, { meta: meta },
            React.createElement(ConfigEditor, Object.assign({}, newProps))));
        yield waitFor(() => expect(screen.getByText('Select log groups')).toBeInTheDocument());
        const rerenderProps = Object.assign(Object.assign({}, newProps), { options: Object.assign(Object.assign({}, newProps.options), { jsonData: Object.assign(Object.assign({}, newProps.options.jsonData), { authType: AwsAuthType.Default }) }) });
        rerender(React.createElement(PluginContextProvider, { meta: meta },
            React.createElement(ConfigEditor, Object.assign({}, rerenderProps))));
        yield waitFor(() => expect(screen.getByText('AWS SDK Default')).toBeInTheDocument());
        yield userEvent.click(screen.getByText('Select log groups'));
        yield waitFor(() => expect(screen.getByText('You have unsaved connection detail changes. You need to save the data source before adding log groups.')).toBeInTheDocument());
    }));
    it('should open log group selector if Select log group button is clicked when data source has saved changes', () => __awaiter(void 0, void 0, void 0, function* () {
        const newProps = Object.assign(Object.assign({}, props), { options: Object.assign(Object.assign({}, props.options), { version: 1 }) });
        const meta = Object.assign(Object.assign({}, newProps.options), { id: 'cloudwatch', type: PluginType.datasource, info: {}, module: '', baseUrl: '' });
        const { rerender } = render(React.createElement(PluginContextProvider, { meta: meta },
            React.createElement(ConfigEditor, Object.assign({}, newProps))));
        yield waitFor(() => expect(screen.getByText('Select log groups')).toBeInTheDocument());
        const rerenderProps = Object.assign(Object.assign({}, newProps), { options: Object.assign(Object.assign({}, newProps.options), { version: 2 }) });
        rerender(React.createElement(PluginContextProvider, { meta: meta },
            React.createElement(ConfigEditor, Object.assign({}, rerenderProps))));
        yield userEvent.click(screen.getByText('Select log groups'));
        yield waitFor(() => expect(screen.getByText('Log group name prefix')).toBeInTheDocument());
    }));
});
//# sourceMappingURL=ConfigEditor.test.js.map