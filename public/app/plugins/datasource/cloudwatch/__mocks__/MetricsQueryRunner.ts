import { of } from 'rxjs';

import {
  CustomVariableModel,
  DataQueryError,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
} from '@grafana/data';
import { TemplateSrv } from 'app/features/templating/template_srv';

import { CloudWatchMetricsQueryRunner } from '../query-runner/CloudWatchMetricsQueryRunner';
import { CloudWatchJsonData, CloudWatchQuery } from '../types';

import { CloudWatchSettings, setupMockedTemplateService } from './CloudWatchDataSource';
import { TimeRangeMock } from './timeRange';

export function setupMockedMetricsQueryRunner({
  response = { data: [] },
  variables,
  mockGetVariableName = true,
  instanceSettings = CloudWatchSettings,
}: {
  response?: DataQueryResponse;
  variables?: CustomVariableModel[];
  mockGetVariableName?: boolean;
  errorResponse?: DataQueryError;
  instanceSettings?: DataSourceInstanceSettings<CloudWatchJsonData>;
} = {}) {
  let templateService = new TemplateSrv();
  if (variables) {
    templateService = setupMockedTemplateService(variables);
    if (mockGetVariableName) {
      templateService.getVariableName = (name: string) => name.replace('$', '');
    }
  }

  const queryMock = jest.fn().mockImplementation(() => of(response));
  const runner = new CloudWatchMetricsQueryRunner(instanceSettings, templateService);

  const request: DataQueryRequest<CloudWatchQuery> = {
    range: TimeRangeMock,
    rangeRaw: { from: '1483228800', to: '1483232400' },
    targets: [],
    requestId: '',
    interval: '',
    intervalMs: 0,
    scopedVars: {},
    timezone: '',
    app: '',
    startTime: 0,
  };

  return { runner, queryMock, templateService, instanceSettings, request, timeRange: TimeRangeMock };
}
