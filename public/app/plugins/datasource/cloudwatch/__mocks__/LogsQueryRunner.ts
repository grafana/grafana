import { of } from 'rxjs';

import { CustomVariableModel, DataFrame } from '@grafana/data';
import { BackendDataSourceResponse, getBackendSrv, setBackendSrv } from '@grafana/runtime';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { TemplateSrv } from 'app/features/templating/template_srv';

import { CloudWatchLogsQueryRunner } from '../query-runner/CloudWatchLogsQueryRunner';
import { CloudWatchLogsQueryStatus } from '../types';

import { CloudWatchSettings, setupMockedTemplateService } from './CloudWatchDataSource';

export function setupMockedLogsQueryRunner({
  data = {
    results: {},
  },
  variables,
  mockGetVariableName = true,
}: { data?: BackendDataSourceResponse; variables?: CustomVariableModel[]; mockGetVariableName?: boolean } = {}) {
  let templateService = new TemplateSrv();
  if (variables) {
    templateService = setupMockedTemplateService(variables);
    if (mockGetVariableName) {
      templateService.getVariableName = (name: string) => name;
    }
  }

  const runner = new CloudWatchLogsQueryRunner(CloudWatchSettings, templateService, getTimeSrv());
  const fetchMock = jest.fn().mockReturnValue(of({ data }));
  setBackendSrv({
    ...getBackendSrv(),
    fetch: fetchMock,
  });

  return { runner, fetchMock, templateService };
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
