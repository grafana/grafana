import { isSharedDashboardQuery } from './runSharedRequest';
import { DataSourceApi } from '@grafana/data';

describe('SharedQueryRunner', () => {
  it('should identify shared queries', () => {
    expect(isSharedDashboardQuery('-- Dashboard --')).toBe(true);

    expect(isSharedDashboardQuery('')).toBe(false);
    expect(isSharedDashboardQuery((undefined as unknown) as string | DataSourceApi)).toBe(false);
    expect(isSharedDashboardQuery((null as unknown) as string | DataSourceApi)).toBe(false);

    const ds = {
      meta: {
        name: '-- Dashboard --',
      },
    } as DataSourceApi;
    expect(isSharedDashboardQuery(ds)).toBe(true);

    ds.meta!.name = 'something else';
    expect(isSharedDashboardQuery(ds)).toBe(false);
  });
});
