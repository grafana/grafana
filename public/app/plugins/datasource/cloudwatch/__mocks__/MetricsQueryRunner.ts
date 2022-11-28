import { of, throwError } from 'rxjs';

import { CustomVariableModel, DataQueryError, DataQueryRequest, DataSourceInstanceSettings } from '@grafana/data';
import { BackendDataSourceResponse, getBackendSrv, setBackendSrv } from '@grafana/runtime';
import { TemplateSrv } from 'app/features/templating/template_srv';

import { CloudWatchMetricsQueryRunner } from '../query-runner/CloudWatchMetricsQueryRunner';
import { CloudWatchJsonData, CloudWatchQuery } from '../types';

import { CloudWatchSettings, setupMockedTemplateService } from './CloudWatchDataSource';
import { timeRange } from './timeRange';

export function setupMockedMetricsQueryRunner({
  data = {
    results: {},
  },
  variables,
  mockGetVariableName = true,
  throws = false,
  instanceSettings = CloudWatchSettings,
}: {
  data?: BackendDataSourceResponse | DataQueryError;
  variables?: CustomVariableModel[];
  mockGetVariableName?: boolean;
  throws?: boolean;
  instanceSettings?: DataSourceInstanceSettings<CloudWatchJsonData>;
} = {}) {
  let templateService = new TemplateSrv();
  if (variables) {
    templateService = setupMockedTemplateService(variables);
    if (mockGetVariableName) {
      templateService.getVariableName = (name: string) => name.replace('$', '');
    }
  }

  const runner = new CloudWatchMetricsQueryRunner(instanceSettings, templateService);
  const fetchMock = throws
    ? jest.fn().mockImplementation(() => throwError(data))
    : jest.fn().mockReturnValue(of({ data }));

  setBackendSrv({
    ...getBackendSrv(),
    fetch: fetchMock,
  });

  const request: DataQueryRequest<CloudWatchQuery> = {
    range: timeRange,
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

  return { runner, fetchMock, templateService, instanceSettings, request, timeRange };
}
