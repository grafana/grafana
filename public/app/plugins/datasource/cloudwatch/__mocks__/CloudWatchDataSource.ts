import { dateTime } from '@grafana/data';
import { setBackendSrv } from '@grafana/runtime';
import { TemplateSrvMock } from '../../../../features/templating/template_srv.mock';
import { initialCustomVariableModelState } from 'app/features/variables/custom/reducer';
import { CustomVariableModel } from 'app/features/variables/types';
import { of } from 'rxjs';
import { CloudWatchDatasource } from '../datasource';
import { TemplateSrv } from 'app/features/templating/template_srv';

export function setupMockedDataSource({ data = [], variables }: { data?: any; variables?: any } = {}) {
  let templateService = new TemplateSrvMock({
    region: 'templatedRegion',
    fields: 'templatedField',
    group: 'templatedGroup',
  }) as any;
  if (variables) {
    templateService = new TemplateSrv();
    templateService.init(variables);
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
  const fetchMock = jest.fn().mockReturnValue(of({ data }));
  setBackendSrv({ fetch: fetchMock } as any);

  return { datasource, fetchMock };
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
