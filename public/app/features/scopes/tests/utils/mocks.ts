import { makeDataSourceSettings } from 'test/helpers/makeDataSourceSettings';
import { seedDataSources } from 'test/helpers/seedDataSources';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';

// Scenes resolves the fixture's `grafana` uid through the async registry without awaiting, so an
// unseeded uid becomes an unhandled rejection that jest-setup rethrows.
export function seedScopesDataSources() {
  const grafana = makeDataSourceSettings('grafana', '-- Grafana --', 'grafana');
  const testData = makeDataSourceSettings('gdev-testdata', 'testDs1', 'grafana-testdata-datasource', {
    isDefault: true,
  });

  seedDataSources(
    [grafana, testData].map((settings) => ({ settings, api: new MockDataSourceApi(settings) })),
    { legacySrv: 'mock' }
  );
}
