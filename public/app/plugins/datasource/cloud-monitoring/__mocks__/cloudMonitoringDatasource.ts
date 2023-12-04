import { TemplateSrv, getTemplateSrv } from '@grafana/runtime';

import Datasource from '../datasource';

export const createMockDatasource = (overrides?: Partial<Datasource>) => {
  const templateSrv = getTemplateSrv() as unknown as TemplateSrv;

  const datasource: Partial<Datasource> = {
    intervalMs: 0,
    getVariables: jest.fn().mockReturnValue([]),
    getMetricTypes: jest.fn().mockResolvedValue([]),
    getProjects: jest.fn().mockResolvedValue([]),
    getDefaultProject: jest.fn().mockReturnValue('cloud-monitoring-default-project'),
    templateSrv,
    filterMetricsByType: jest.fn().mockResolvedValue([]),
    getSLOServices: jest.fn().mockResolvedValue([]),
    migrateQuery: jest.fn().mockImplementation((query) => query),
    ...overrides,
  };

  return jest.mocked(datasource as Datasource);
};
