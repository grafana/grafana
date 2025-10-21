import { migrateQuery } from './useMigratedQuery';

describe('useMigratedQuery', () => {
  it('adds region and queryMode', () => {
    const legacyQuery = {
      statistic: 'Average',
      refId: 'A',
      id: '',
      region: '',
      namespace: 'AWS/EC2',
      period: '300',
      alias: '',
      metricName: 'CPUUtilization',
      dimensions: {},
      matchExact: false,
      expression: '',
    };
    const migratedQuery = migrateQuery(legacyQuery);
    expect(migratedQuery.region).toBe('default');
    expect(migratedQuery.queryMode).toBe('Metrics');
  });
});
