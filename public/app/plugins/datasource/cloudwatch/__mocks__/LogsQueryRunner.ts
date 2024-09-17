import { of } from 'rxjs';

import { CustomVariableModel, DataFrame, DataSourceInstanceSettings } from '@grafana/data';
import { BackendDataSourceResponse, toDataQueryResponse } from '@grafana/runtime';

import { CloudWatchLogsQueryRunner } from '../query-runner/CloudWatchLogsQueryRunner';
import { CloudWatchJsonData, CloudWatchLogsQueryStatus, CloudWatchLogsRequest } from '../types';

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

export function genMockFrames(numResponses: number): DataFrame[] {
  const recordIncrement = 50;
  const mockFrames: DataFrame[] = [];

  for (let i = 0; i < numResponses; i++) {
    mockFrames.push({
      fields: [],
      meta: {
        custom: {
          Status: i === numResponses - 1 ? CloudWatchLogsQueryStatus.Complete : CloudWatchLogsQueryStatus.Running,
        },
        stats: [
          {
            displayName: 'Records scanned',
            value: (i + 1) * recordIncrement,
          },
        ],
      },
      refId: 'A',
      length: 0,
    });
  }

  return mockFrames;
}

export function genMockCloudWatchLogsRequest(overrides: Partial<CloudWatchLogsRequest> = {}) {
  const request: CloudWatchLogsRequest = {
    queryString: 'fields @timestamp, @message | sort @timestamp desc',
    logGroupNames: ['log-group-name-1', 'log-group-name-2'],
    logGroups: [
      { arn: 'log-group-arn-1', name: 'log-group-name-1' },
      { arn: 'log-group-arn-2', name: 'log-group-name-2' },
    ],
    refId: 'A',
    region: 'us-east-1',
    ...overrides,
  };

  return request;
}
