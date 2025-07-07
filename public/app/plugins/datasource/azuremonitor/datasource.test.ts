import Datasource from './datasource';
import { createMockInstanceSetttings } from './mocks/instanceSettings';
import createMockQuery from './mocks/query';
import { singleVariable } from './mocks/variables';
import { AzureQueryType } from './types/query';

jest.mock('@grafana/runtime', () => {
  return {
    __esModule: true,
    ...jest.requireActual('@grafana/runtime'),
    getTemplateSrv: () => ({
      replace: (target?: string) => {
        if (target === '$resourceGroup') {
          return 'the-resource-group';
        }
        return target || '';
      },
      getVariables: jest.fn(),
      updateTimeRange: jest.fn(),
      containsTemplate: (target?: string) => {
        return (target || '').includes('$');
      },
    }),
  };
});

describe('Azure Monitor Datasource', () => {
  describe('interpolateVariablesInQueries()', () => {
    it('should interpolate variables in the queries', () => {
      const ds = new Datasource(createMockInstanceSetttings());
      const queries = [createMockQuery({ azureMonitor: { resources: [{ resourceGroup: '$resourceGroup' }] } })];

      const interpolatedQueries = ds.interpolateVariablesInQueries(queries, {
        resourceGroup: { text: 'the-resource-group', value: 'the-resource-group' },
      });

      expect(interpolatedQueries).toContainEqual(
        expect.objectContaining({
          azureMonitor: expect.objectContaining({
            resources: [expect.objectContaining({ resourceGroup: 'the-resource-group' })],
          }),
        })
      );
    });

    it('should include a datasource ref when interpolating queries', () => {
      const ds = new Datasource(createMockInstanceSetttings());
      const query = createMockQuery();
      delete query.datasource;
      const queries = [query];

      const interpolatedQueries = ds.interpolateVariablesInQueries(queries, {});

      expect(interpolatedQueries).toContainEqual(
        expect.objectContaining({
          datasource: expect.objectContaining({ type: 'azuremonitor', uid: 'abc' }),
        })
      );
    });
  });

  it('should not filter a valid query', () => {
    const ds = new Datasource(createMockInstanceSetttings());
    const query = createMockQuery();
    expect(ds.filterQuery(query)).toBe(true);
  });

  it('should filter out a query with no query type', () => {
    const ds = new Datasource(createMockInstanceSetttings());
    const query = createMockQuery();
    delete query.queryType;
    expect(ds.filterQuery(query)).toBe(false);
  });

  describe('When performing targetContainsTemplate', () => {
    it('should return false when no variable is being used', () => {
      const query = {
        ...createMockQuery(),
        queryType: AzureQueryType.AzureResourceGraph,
      };
      const ds = new Datasource(createMockInstanceSetttings());
      expect(ds.targetContainsTemplate(query)).toEqual(false);
    });

    it('should return true when resource field is using a variable', () => {
      const query = {
        ...createMockQuery(),
        queryType: AzureQueryType.AzureResourceGraph,
        azureResourceGraph: { query: '$temp-var' },
      };
      const ds = new Datasource(createMockInstanceSetttings());
      expect(ds.targetContainsTemplate(query)).toEqual(true);
    });

    it('should return true when resource field is using a variable in the subscriptions field', () => {
      const query = {
        ...createMockQuery(),
        queryType: AzureQueryType.AzureResourceGraph,
        subscriptions: ['$temp-var'],
      };
      const ds = new Datasource(createMockInstanceSetttings());
      expect(ds.targetContainsTemplate(query)).toEqual(true);
    });

    it('should return false when a variable is used in a different part of the query', () => {
      const query = {
        ...createMockQuery(),
        queryType: AzureQueryType.AzureResourceGraph,
        azureMonitor: { metricName: `$${singleVariable.name}` },
      };
      const ds = new Datasource(createMockInstanceSetttings());
      expect(ds.targetContainsTemplate(query)).toEqual(false);
    });
  });
});
