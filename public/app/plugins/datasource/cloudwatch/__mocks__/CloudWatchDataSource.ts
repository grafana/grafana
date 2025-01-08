import { of } from 'rxjs';

import {
  CustomVariableModel,
  DataSourceInstanceSettings,
  DataSourcePluginMeta,
  PluginMetaInfo,
  PluginType,
  ScopedVars,
  VariableHide,
} from '@grafana/data';
import { getBackendSrv, setBackendSrv, DataSourceWithBackend, TemplateSrv } from '@grafana/runtime';

import { initialCustomVariableModelState } from '../__mocks__/CloudWatchVariables';
import { CloudWatchDatasource } from '../datasource';
import { CloudWatchJsonData } from '../types';
import { getVariableName } from '../utils/templateVariableUtils';

const queryMock = jest.fn().mockReturnValue(of({ data: [] }));
jest.spyOn(DataSourceWithBackend.prototype, 'query').mockImplementation((args) => queryMock(args));
const separatorMap = new Map<string, string>([
  ['pipe', '|'],
  ['raw', ','],
  ['text', ' + '],
]);

export function setupMockedTemplateService(variables?: CustomVariableModel[]): TemplateSrv {
  const templateService = {
    replace: jest.fn().mockImplementation((input: string, scopedVars?: ScopedVars, format?: string) => {
      if (!input) {
        return '';
      }
      let output = input;
      ['datasource', 'dimension'].forEach((name) => {
        const variable = scopedVars ? scopedVars[name] : undefined;
        if (variable) {
          output = output.replace('$' + name, variable.value);
        }
      });

      if (variables) {
        variables.forEach((variable) => {
          let repVal = '';
          let value = format === 'text' ? variable.current.text : variable.current.value;
          let separator = separatorMap.get(format ?? 'raw');
          if (Array.isArray(value)) {
            repVal = value.join(separator);
          } else {
            repVal = value;
          }
          output = output.replace('$' + variable.name, repVal);
          output = output.replace('[[' + variable.name + ']]', repVal);
        });
      }
      return output;
    }),
    getVariables: jest.fn().mockReturnValue(variables ?? []),
    containsTemplate: jest.fn().mockImplementation((name) => {
      const varName = getVariableName(name);
      if (!varName || !variables) {
        return false;
      }
      let found = false;
      variables.forEach((variable) => {
        if (varName === variable.name) {
          found = true;
        }
      });
      return found;
    }),
    updateTimeRange: jest.fn(),
  };
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
  getMock = jest.fn(),
  customInstanceSettings = CloudWatchSettings,
}: {
  getMock?: jest.Func;
  variables?: CustomVariableModel[];
  customInstanceSettings?: DataSourceInstanceSettings<CloudWatchJsonData>;
} = {}) {
  const templateService = setupMockedTemplateService(variables);

  const datasource = new CloudWatchDatasource(customInstanceSettings, templateService);
  datasource.getVariables = () => ['test'];
  datasource.resources.getNamespaces = jest.fn().mockResolvedValue([]);
  datasource.resources.getRegions = jest.fn().mockResolvedValue([]);
  datasource.resources.getDimensionKeys = jest.fn().mockResolvedValue([]);
  datasource.resources.getMetrics = jest.fn().mockResolvedValue([]);
  datasource.resources.getAccounts = jest.fn().mockResolvedValue([]);
  datasource.resources.getLogGroups = jest.fn().mockResolvedValue([]);
  datasource.resources.isMonitoringAccount = jest.fn().mockResolvedValue(false);
  const fetchMock = jest.fn().mockReturnValue(of({}));
  setBackendSrv({
    ...getBackendSrv(),
    fetch: fetchMock,
    get: getMock,
  });

  return { datasource, fetchMock, queryMock, templateService };
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
