import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { TemplateSrvMock } from 'app/features/templating/template_srv.mock';
export const createMockDatasource = (overrides) => {
    const templateSrv = new TemplateSrvMock({ ALIGN_DELTA: 'delta' });
    const datasource = Object.assign({ intervalMs: 0, getVariables: jest.fn().mockReturnValue([]), getMetricTypes: jest.fn().mockResolvedValue([]), getProjects: jest.fn().mockResolvedValue([]), getDefaultProject: jest.fn().mockReturnValue('cloud-monitoring-default-project'), templateSrv, filterMetricsByType: jest.fn().mockResolvedValue([]), getSLOServices: jest.fn().mockResolvedValue([]), migrateQuery: jest.fn().mockImplementation((query) => query), timeSrv: getTimeSrv() }, overrides);
    return jest.mocked(datasource);
};
//# sourceMappingURL=cloudMonitoringDatasource.js.map