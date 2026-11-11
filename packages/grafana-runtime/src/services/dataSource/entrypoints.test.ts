import * as stable from '../../index';
import * as unstable from '../../unstable';

const graduatedDataSourceApis = [
  'getDataSourceInstanceSettings',
  'getDataSourceInstanceList',
  'getDefaultDataSourceInstanceListItem',
  'hasDataSourceInstance',
  'reloadDataSourceInstanceSettings',
  'getDataSourceInstance',
  'registerRuntimeDataSourceInstance',
  'getDataSourceInstanceListItem',
  'useDataSourceInstanceSettings',
  'useDataSourceInstance',
  'useDataSourceInstanceList',
  'useDataSourceInstanceListItem',
  'useDefaultDataSourceInstanceListItem',
  'useHasDataSourceInstance',
] as const;

describe('async data source APIs', () => {
  it.each(graduatedDataSourceApis)('exports %s from the stable entrypoint', (name) => {
    expect(stable[name]).toEqual(expect.any(Function));
  });

  // @grafana/plugin-compat <= 0.7.0 feature-detects these on the host's `@grafana/runtime/unstable` and silently
  // falls back to the legacy implementation when one is missing, so they must stay for plugins bundling it.
  it.each(graduatedDataSourceApis)('keeps %s on the unstable entrypoint as the same function', (name) => {
    expect(unstable[name]).toBe(stable[name]);
  });
});
