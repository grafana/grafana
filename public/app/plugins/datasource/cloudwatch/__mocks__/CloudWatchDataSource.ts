import { of } from 'rxjs';

import { dateTime } from '@grafana/data';
import { setBackendSrv } from '@grafana/runtime';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { initialCustomVariableModelState } from 'app/features/variables/custom/reducer';
import { CustomVariableModel } from 'app/features/variables/types';

import { TemplateSrvMock } from '../../../../features/templating/template_srv.mock';
import { CloudWatchDatasource } from '../datasource';

export function setupMockedDataSource({
  data = [],
  variables,
  mockGetVariableName = true,
}: { data?: any; variables?: any; mockGetVariableName?: boolean } = {}) {
  let templateService = new TemplateSrvMock({
    region: 'templatedRegion',
    fields: 'templatedField',
    group: 'templatedGroup',
  }) as any;
  if (variables) {
    templateService = new TemplateSrv();
    templateService.init(variables);
    templateService.getVariables = jest.fn().mockReturnValue(variables);
    if (mockGetVariableName) {
      templateService.getVariableName = (name: string) => name;
    }
  }

  const datasource = new CloudWatchDatasource(
    {
      jsonData: { defaultRegion: 'us-west-1', tracingDatasourceUid: 'xray' },
    } as any,
    templateService,
    {
      timeRange() {
        const time = dateTime('2021-01-01T01:00:00Z');
        const range = {
          from: time.subtract(6, 'hour'),
          to: time,
        };

        return {
          ...range,
          raw: range,
        };
      },
    } as any
  );
  datasource.getVariables = () => ['test'];

  datasource.getNamespaces = jest.fn().mockResolvedValue([]);
  datasource.getRegions = jest.fn().mockResolvedValue([]);
  datasource.defaultLogGroups = [];
  const fetchMock = jest.fn().mockReturnValue(of({ data }));
  setBackendSrv({ fetch: fetchMock } as any);

  return { datasource, fetchMock, templateService };
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
    value: ['templatedGroup-1', 'templatedGroup-2'],
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

export const expressionVariable: CustomVariableModel = {
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
