import Datasource from '../datasource';

export const createMockDatasource = () => {
  const datasource: Partial<Datasource> = {
    intervalMs: 0,
    getVariables: jest.fn().mockReturnValue([]),
    getMetricTypes: jest.fn().mockResolvedValue([]),
    getProjects: jest.fn().mockResolvedValue([]),
    getDefaultProject: jest.fn().mockReturnValue('cloud-monitoring-default-project'),
  };

  return jest.mocked(datasource as Datasource, true);
};
