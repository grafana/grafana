import { of } from 'rxjs';

import { type CustomVariableModel, type DataSourceInstanceSettings } from '@grafana/data';
import { type BackendDataSourceResponse, toDataQueryResponse } from '@grafana/runtime';

import { CloudWatchLogsQueryRunner } from '../query-runner/CloudWatchLogsQueryRunner';
import { type CloudWatchJsonData } from '../types';

import { CloudWatchSettings, setupMockedTemplateService } from './CloudWatchDataSource';

export function setupMockedLogsQueryRunner({
  data = {
    results: {},
  },
  variables,
  settings = CloudWatchSettings,
}: {
  data?: BackendDataSourceResponse;
  variables?: CustomVariableModel[];
  settings?: DataSourceInstanceSettings<CloudWatchJsonData>;
} = {}) {
  let templateService = setupMockedTemplateService(variables);

  const queryMock = jest.fn().mockReturnValue(of(toDataQueryResponse({ data })));
  const runner = new CloudWatchLogsQueryRunner(settings, templateService);

  return { runner, queryMock, templateService };
}
