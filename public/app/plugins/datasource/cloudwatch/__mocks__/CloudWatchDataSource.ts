import { of } from 'rxjs';

import {
  CustomVariableModel,
  DataSourceInstanceSettings,
  DataSourcePluginMeta,
  PluginMetaInfo,
  PluginType,
  VariableHide,
} from '@grafana/data';
import { getBackendSrv, setBackendSrv } from '@grafana/runtime';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { initialCustomVariableModelState } from 'app/features/variables/custom/reducer';

import { CloudWatchDatasource } from '../datasource';
import { CloudWatchJsonData } from '../types';

export function setupMockedTemplateService(variables: CustomVariableModel[]) {
  const templateService = new TemplateSrv();
  templateService.init(variables);
  templateService.getVariables = jest.fn().mockReturnValue(variables);
  return templateService;
}

const info: PluginMetaInfo = {
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

export const meta: DataSourcePluginMeta<CloudWatchJsonData> = {
  id: '',
  name: '',
  type: PluginType.datasource,
  info,
  module: '',
  baseUrl: '',
};

export const CloudWatchSettings: DataSourceInstanceSettings<CloudWatchJsonData> = {
  jsonData: { defaultRegion: 'us-west-1', tracingDatasourceUid: 'xray', logGroups: [] },
  id: 0,
  uid: '',
  type: '',
  name: 'CloudWatch Test Datasource',
  meta,
  readOnly: false,
  access: 'direct',
};

export function setupMockedDataSource({
  variables,
  mockGetVariableName = true,
  getMock = jest.fn(),
  customInstanceSettings = CloudWatchSettings,
}: {
  getMock?: jest.Func;
  variables?: CustomVariableModel[];
  mockGetVariableName?: boolean;
  customInstanceSettings?: DataSourceInstanceSettings<CloudWatchJsonData>;
} = {}) {
  let templateService = new TemplateSrv();
  if (variables) {
    templateService = setupMockedTemplateService(variables);
    if (mockGetVariableName) {
      templateService.getVariableName = (name: string) => name.replace('$', '');
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
  setBackendSrv({
    ...getBackendSrv(),
    fetch: fetchMock,
    get: getMock,
  });

  return { datasource, fetchMock, templateService, timeSrv };
}

export const metricVariable: CustomVariableModel = {
  ...initialCustomVariableModelState,
  id: 'metric',
  name: 'metric',
  current: { value: 'CPUUtilization', text: 'CPUUtilizationEC2', selected: true },
  options: [
    { value: 'DroppedBytes', text: 'DroppedBytes', selected: false },
    { value: 'CPUUtilization', text: 'CPUUtilization', selected: false },
  ],
  multi: false,
};

export const namespaceVariable: CustomVariableModel = {
  ...initialCustomVariableModelState,
  id: 'namespace',
  name: 'namespace',
  query: 'namespaces()',
  current: { value: 'AWS/EC2', text: 'AWS/EC2', selected: true },
  options: [
    { value: 'AWS/Redshift', text: 'AWS/Redshift', selected: false },
    { value: 'AWS/EC2', text: 'AWS/EC2', selected: false },
    { value: 'AWS/MQ', text: 'AWS/MQ', selected: false },
  ],
  multi: false,
};

export const labelsVariable: CustomVariableModel = {
  ...initialCustomVariableModelState,
  id: 'labels',
  name: 'labels',
  current: {
    value: ['InstanceId', 'InstanceType'],
    text: ['InstanceId', 'InstanceType'].toString(),
    selected: true,
  },
  options: [
    { value: 'InstanceId', text: 'InstanceId', selected: false },
    { value: 'InstanceType', text: 'InstanceType', selected: false },
  ],
  multi: true,
};

export const limitVariable: CustomVariableModel = {
  ...initialCustomVariableModelState,
  id: 'limit',
  name: 'limit',
  current: {
    value: '100',
    text: '100',
    selected: true,
  },
  options: [
    { value: '10', text: '10', selected: false },
    { value: '100', text: '100', selected: false },
    { value: '1000', text: '1000', selected: false },
  ],
  multi: false,
};

export const aggregationvariable: CustomVariableModel = {
  ...initialCustomVariableModelState,
  id: 'aggregation',
  name: 'aggregation',
  current: {
    value: 'AVG',
    text: 'AVG',
    selected: true,
  },
  options: [
    { value: 'AVG', text: 'AVG', selected: false },
    { value: 'SUM', text: 'SUM', selected: false },
    { value: 'MIN', text: 'MIN', selected: false },
  ],
  multi: false,
};

export const dimensionVariable: CustomVariableModel = {
  ...initialCustomVariableModelState,
  id: 'dimension',
  name: 'dimension',
  current: {
    value: 'env',
    text: 'env',
    selected: true,
  },
  options: [
    { value: 'env', text: 'env', selected: false },
    { value: 'tag', text: 'tag', selected: false },
  ],
  multi: false,
};

export const logGroupNamesVariable: CustomVariableModel = {
  ...initialCustomVariableModelState,
  id: 'groups',
  name: 'groups',
  current: {
    value: ['templatedGroup-arn-1', 'templatedGroup-arn-2'],
    text: ['templatedGroup-1', 'templatedGroup-2'],
    selected: true,
  },
  options: [
    { value: 'templatedGroup-1', text: 'templatedGroup-1', selected: true },
    { value: 'templatedGroup-2', text: 'templatedGroup-2', selected: true },
  ],
  multi: true,
};

export const regionVariable: CustomVariableModel = {
  ...initialCustomVariableModelState,
  id: 'region',
  name: 'region',
  current: {
    value: 'templatedRegion',
    text: 'templatedRegion',
    selected: true,
  },
  options: [{ value: 'templatedRegion', text: 'templatedRegion', selected: true }],
  multi: false,
};

export const fieldsVariable: CustomVariableModel = {
  ...initialCustomVariableModelState,
  id: 'fields',
  name: 'fields',
  current: {
    value: 'templatedField',
    text: 'templatedField',
    selected: true,
  },
  options: [{ value: 'templatedField', text: 'templatedField', selected: true }],
  multi: false,
};

export const periodIntervalVariable: CustomVariableModel = {
  ...initialCustomVariableModelState,
  id: 'period',
  name: 'period',
  index: 0,
  current: { value: '10m', text: '10m', selected: true },
  options: [{ value: '10m', text: '10m', selected: true }],
  multi: false,
  includeAll: false,
  query: '',
  hide: VariableHide.dontHide,
  type: 'custom',
};

export const accountIdVariable: CustomVariableModel = {
  ...initialCustomVariableModelState,
  id: 'accountId',
  name: 'accountId',
  current: {
    value: 'templatedaccountId',
    text: 'templatedaccountId',
    selected: true,
  },
  options: [{ value: 'templatedRegion', text: 'templatedRegion', selected: true }],
  multi: false,
};

export const statisticVariable: CustomVariableModel = {
  ...initialCustomVariableModelState,
  id: 'statistic',
  name: 'statistic',
  current: { value: 'some stat', text: 'some stat', selected: true },
  multi: false,
};
