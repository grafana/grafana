import { of } from 'rxjs';
import { PluginType, VariableHide, } from '@grafana/data';
import { getBackendSrv, setBackendSrv } from '@grafana/runtime';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { initialCustomVariableModelState } from 'app/features/variables/custom/reducer';
import { CloudWatchDatasource } from '../datasource';
export function setupMockedTemplateService(variables) {
    const templateService = new TemplateSrv();
    templateService.init(variables);
    templateService.getVariables = jest.fn().mockReturnValue(variables);
    return templateService;
}
const info = {
    author: {
        name: '',
    },
    description: '',
    links: [],
    logos: {
        large: '',
        small: '',
    },
    screenshots: [],
    updated: '',
    version: '',
};
export const meta = {
    id: '',
    name: '',
    type: PluginType.datasource,
    info,
    module: '',
    baseUrl: '',
};
export const CloudWatchSettings = {
    jsonData: { defaultRegion: 'us-west-1', tracingDatasourceUid: 'xray', logGroups: [] },
    id: 0,
    uid: '',
    type: '',
    name: 'CloudWatch Test Datasource',
    meta,
    readOnly: false,
    access: 'direct',
};
export function setupMockedDataSource({ variables, mockGetVariableName = true, getMock = jest.fn(), customInstanceSettings = CloudWatchSettings, } = {}) {
    let templateService = new TemplateSrv();
    if (variables) {
        templateService = setupMockedTemplateService(variables);
        if (mockGetVariableName) {
            templateService.getVariableName = (name) => name.replace('$', '');
        }
    }
    const timeSrv = getTimeSrv();
    const datasource = new CloudWatchDatasource(customInstanceSettings, templateService, timeSrv);
    datasource.getVariables = () => ['test'];
    datasource.resources.getNamespaces = jest.fn().mockResolvedValue([]);
    datasource.resources.getRegions = jest.fn().mockResolvedValue([]);
    datasource.resources.getDimensionKeys = jest.fn().mockResolvedValue([]);
    datasource.resources.getMetrics = jest.fn().mockResolvedValue([]);
    datasource.resources.getAccounts = jest.fn().mockResolvedValue([]);
    datasource.resources.getLogGroups = jest.fn().mockResolvedValue([]);
    const fetchMock = jest.fn().mockReturnValue(of({}));
    setBackendSrv(Object.assign(Object.assign({}, getBackendSrv()), { fetch: fetchMock, get: getMock }));
    return { datasource, fetchMock, templateService, timeSrv };
}
export const metricVariable = Object.assign(Object.assign({}, initialCustomVariableModelState), { id: 'metric', name: 'metric', current: { value: 'CPUUtilization', text: 'CPUUtilizationEC2', selected: true }, options: [
        { value: 'DroppedBytes', text: 'DroppedBytes', selected: false },
        { value: 'CPUUtilization', text: 'CPUUtilization', selected: false },
    ], multi: false });
export const namespaceVariable = Object.assign(Object.assign({}, initialCustomVariableModelState), { id: 'namespace', name: 'namespace', query: 'namespaces()', current: { value: 'AWS/EC2', text: 'AWS/EC2', selected: true }, options: [
        { value: 'AWS/Redshift', text: 'AWS/Redshift', selected: false },
        { value: 'AWS/EC2', text: 'AWS/EC2', selected: false },
        { value: 'AWS/MQ', text: 'AWS/MQ', selected: false },
    ], multi: false });
export const labelsVariable = Object.assign(Object.assign({}, initialCustomVariableModelState), { id: 'labels', name: 'labels', current: {
        value: ['InstanceId', 'InstanceType'],
        text: ['InstanceId', 'InstanceType'].toString(),
        selected: true,
    }, options: [
        { value: 'InstanceId', text: 'InstanceId', selected: false },
        { value: 'InstanceType', text: 'InstanceType', selected: false },
    ], multi: true });
export const limitVariable = Object.assign(Object.assign({}, initialCustomVariableModelState), { id: 'limit', name: 'limit', current: {
        value: '100',
        text: '100',
        selected: true,
    }, options: [
        { value: '10', text: '10', selected: false },
        { value: '100', text: '100', selected: false },
        { value: '1000', text: '1000', selected: false },
    ], multi: false });
export const aggregationvariable = Object.assign(Object.assign({}, initialCustomVariableModelState), { id: 'aggregation', name: 'aggregation', current: {
        value: 'AVG',
        text: 'AVG',
        selected: true,
    }, options: [
        { value: 'AVG', text: 'AVG', selected: false },
        { value: 'SUM', text: 'SUM', selected: false },
        { value: 'MIN', text: 'MIN', selected: false },
    ], multi: false });
export const dimensionVariable = Object.assign(Object.assign({}, initialCustomVariableModelState), { id: 'dimension', name: 'dimension', current: {
        value: 'env',
        text: 'env',
        selected: true,
    }, options: [
        { value: 'env', text: 'env', selected: false },
        { value: 'tag', text: 'tag', selected: false },
    ], multi: false });
export const logGroupNamesVariable = Object.assign(Object.assign({}, initialCustomVariableModelState), { id: 'groups', name: 'groups', current: {
        value: ['templatedGroup-arn-1', 'templatedGroup-arn-2'],
        text: ['templatedGroup-1', 'templatedGroup-2'],
        selected: true,
    }, options: [
        { value: 'templatedGroup-1', text: 'templatedGroup-1', selected: true },
        { value: 'templatedGroup-2', text: 'templatedGroup-2', selected: true },
    ], multi: true });
export const regionVariable = Object.assign(Object.assign({}, initialCustomVariableModelState), { id: 'region', name: 'region', current: {
        value: 'templatedRegion',
        text: 'templatedRegion',
        selected: true,
    }, options: [{ value: 'templatedRegion', text: 'templatedRegion', selected: true }], multi: false });
export const fieldsVariable = Object.assign(Object.assign({}, initialCustomVariableModelState), { id: 'fields', name: 'fields', current: {
        value: 'templatedField',
        text: 'templatedField',
        selected: true,
    }, options: [{ value: 'templatedField', text: 'templatedField', selected: true }], multi: false });
export const periodIntervalVariable = Object.assign(Object.assign({}, initialCustomVariableModelState), { id: 'period', name: 'period', index: 0, current: { value: '10m', text: '10m', selected: true }, options: [{ value: '10m', text: '10m', selected: true }], multi: false, includeAll: false, query: '', hide: VariableHide.dontHide, type: 'custom' });
export const accountIdVariable = Object.assign(Object.assign({}, initialCustomVariableModelState), { id: 'accountId', name: 'accountId', current: {
        value: 'templatedaccountId',
        text: 'templatedaccountId',
        selected: true,
    }, options: [{ value: 'templatedRegion', text: 'templatedRegion', selected: true }], multi: false });
export const statisticVariable = Object.assign(Object.assign({}, initialCustomVariableModelState), { id: 'statistic', name: 'statistic', current: { value: 'some stat', text: 'some stat', selected: true }, multi: false });
//# sourceMappingURL=CloudWatchDataSource.js.map