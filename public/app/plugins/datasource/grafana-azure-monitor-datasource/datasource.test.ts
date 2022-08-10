import { createMockInstanceSetttings } from './__mocks__/instanceSettings';
import createMockQuery from './__mocks__/query';
import Datasource from './datasource';

describe('Azure Monitor Datasource', () => {
  describe('interpolateVariablesInQueries()', () => {
    it('should interpolate variables in the queries', () => {
      const ds = new Datasource(createMockInstanceSetttings());
      const queries = [createMockQuery({ azureMonitor: { resourceGroup: '$resourceGroup' } })];

      const interpolatedQueries = ds.interpolateVariablesInQueries(queries, {
        resourceGroup: { text: 'the-resource-group', value: 'the-resource-group' },
      });

      expect(interpolatedQueries).toContainEqual(
        expect.objectContaining({
          azureMonitor: expect.objectContaining({ resourceGroup: 'the-resource-group' }),
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
});
