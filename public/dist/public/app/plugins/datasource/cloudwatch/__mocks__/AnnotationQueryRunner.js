import { of } from 'rxjs';
import { getBackendSrv, setBackendSrv } from '@grafana/runtime';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { CloudWatchAnnotationQueryRunner } from '../query-runner/CloudWatchAnnotationQueryRunner';
import { CloudWatchSettings, setupMockedTemplateService } from './CloudWatchDataSource';
import { TimeRangeMock } from './timeRange';
export function setupMockedAnnotationQueryRunner({ variables }) {
    let templateService = new TemplateSrv();
    if (variables) {
        templateService = setupMockedTemplateService(variables);
    }
    const runner = new CloudWatchAnnotationQueryRunner(CloudWatchSettings, templateService);
    const fetchMock = jest.fn().mockReturnValue(of({}));
    setBackendSrv(Object.assign(Object.assign({}, getBackendSrv()), { fetch: fetchMock }));
    const request = {
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
    return { runner, fetchMock, templateService, request, timeRange: TimeRangeMock };
}
//# sourceMappingURL=AnnotationQueryRunner.js.map