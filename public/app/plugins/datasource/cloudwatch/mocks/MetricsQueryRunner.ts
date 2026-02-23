import { of } from 'rxjs';

import { CustomVariableModel, DataQueryRequest, DataQueryResponse, DataSourceInstanceSettings } from '@grafana/data';

import { CloudWatchMetricsQueryRunner } from '../query-runner/CloudWatchMetricsQueryRunner';
import { CloudWatchJsonData, CloudWatchQuery } from '../types';

import { CloudWatchSettings, setupMockedTemplateService } from './CloudWatchDataSource';
import { TimeRangeMock } from './timeRange';

export function setupMockedMetricsQueryRunner({
  response = { data: [] },
  variables,
  instanceSettings = CloudWatchSettings,
}: {
  response?: DataQueryResponse;
  variables?: CustomVariableModel[];
  instanceSettings?: DataSourceInstanceSettings<CloudWatchJsonData>;
} = {}) {
  const templateService = setupMockedTemplateService(variables);

  const queryMock = jest.fn().mockImplementation(() => of(response));
  const runner = new CloudWatchMetricsQueryRunner(instanceSettings, templateService);

  const request: DataQueryRequest<CloudWatchQuery> = {
    range: TimeRangeMock,
    rangeRaw: { from: '1483228800', to: '1483232400' },
    targets: [],
    requestId: 'mockId',
    interval: '',
    intervalMs: 0,
    scopedVars: {},
    timezone: '',
    app: '',
    startTime: 0,
  };

  return { runner, queryMock, templateService, instanceSettings, request, timeRange: TimeRangeMock };
}
