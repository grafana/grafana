import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { TemplateSrvMock } from 'app/features/templating/template_srv.mock';

import Datasource from '../datasource';

export const createMockDatasource = (overrides?: Partial<Datasource>) => {
  const templateSrv = new TemplateSrvMock({ ALIGN_DELTA: 'delta' }) as unknown as TemplateSrv;

  const datasource: Partial<Datasource> = {
    intervalMs: 0,
    getVariables: jest.fn().mockReturnValue([]),
    getMetricTypes: jest.fn().mockResolvedValue([]),
    getProjects: jest.fn().mockResolvedValue([]),
    getDefaultProject: jest.fn().mockReturnValue('cloud-monitoring-default-project'),
    templateSrv,
    getSLOServices: jest.fn().mockResolvedValue([]),
    migrateQuery: jest.fn().mockImplementation((query) => query),
    timeSrv: getTimeSrv(),
    ...overrides,
  };

  return jest.mocked(datasource as Datasource);
};
