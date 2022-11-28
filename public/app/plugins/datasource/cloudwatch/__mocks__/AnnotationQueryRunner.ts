import { of } from 'rxjs';

import { CustomVariableModel, DataQueryRequest } from '@grafana/data';
import { getBackendSrv, setBackendSrv } from '@grafana/runtime';
import { TemplateSrv } from 'app/features/templating/template_srv';

import { CloudWatchAnnotationQueryRunner } from '../query-runner/CloudWatchAnnotationQueryRunner';
import { CloudWatchQuery } from '../types';

import { CloudWatchSettings, setupMockedTemplateService } from './CloudWatchDataSource';
import { timeRange } from './timeRange';

export function setupMockedAnnotationQueryRunner({ variables }: { variables?: CustomVariableModel[] }) {
  let templateService = new TemplateSrv();
  if (variables) {
    templateService = setupMockedTemplateService(variables);
  }

  const runner = new CloudWatchAnnotationQueryRunner(CloudWatchSettings, templateService);
  const fetchMock = jest.fn().mockReturnValue(of({}));

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

  return { runner, fetchMock, templateService, request, timeRange };
}
