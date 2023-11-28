import { of, throwError } from 'rxjs';
import { getBackendSrv, setBackendSrv } from '@grafana/runtime';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { CloudWatchMetricsQueryRunner } from '../query-runner/CloudWatchMetricsQueryRunner';
import { CloudWatchSettings, setupMockedTemplateService } from './CloudWatchDataSource';
import { TimeRangeMock } from './timeRange';
export function setupMockedMetricsQueryRunner({ data = {
    results: {},
}, variables, mockGetVariableName = true, throws = false, instanceSettings = CloudWatchSettings, } = {}) {
    let templateService = new TemplateSrv();
    if (variables) {
        templateService = setupMockedTemplateService(variables);
        if (mockGetVariableName) {
            templateService.getVariableName = (name) => name.replace('$', '');
        }
    }
    const runner = new CloudWatchMetricsQueryRunner(instanceSettings, templateService);
    const fetchMock = throws
        ? jest.fn().mockImplementation(() => throwError(data))
        : jest.fn().mockReturnValue(of({ data }));
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
    return { runner, fetchMock, templateService, instanceSettings, request, timeRange: TimeRangeMock };
}
//# sourceMappingURL=MetricsQueryRunner.js.map