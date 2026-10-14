import { type DataSourceInstanceListItem as HostDataSourceInstanceListItem } from '@grafana/data';
import { type GetDataSourceInstanceListFilters as StableGetDataSourceInstanceListFilters } from '@grafana/runtime';
import { type GetDataSourceInstanceListFilters as UnstableGetDataSourceInstanceListFilters } from '@grafana/runtime/unstable';

import { type DataSourceInstanceListItem, type GetDataSourceInstanceListFilters } from '../datasources';

// Keys are compared too, because assignability alone lets an extra optional field through.
type IsSameShape<A, B> = [A, keyof A] extends [B, keyof B] ? ([B, keyof B] extends [A, keyof A] ? true : false) : false;

// Checked by `yarn typecheck`; Jest only runs the empty bodies.
function expectTrue<T extends true>(): void {}

// Strict on purpose, so every core change gets a look here. If core adds a field older hosts can't
// provide, don't copy it: relax this to a one-way check (host items must satisfy compat's type).
describe('datasources types', () => {
  it('should keep DataSourceInstanceListItem in sync with @grafana/data', () => {
    expectTrue<IsSameShape<DataSourceInstanceListItem, HostDataSourceInstanceListItem>>();
  });

  it('should keep GetDataSourceInstanceListFilters in sync with @grafana/runtime', () => {
    expectTrue<IsSameShape<GetDataSourceInstanceListFilters, StableGetDataSourceInstanceListFilters>>();
  });

  it('should keep GetDataSourceInstanceListFilters in sync with @grafana/runtime/unstable', () => {
    expectTrue<IsSameShape<GetDataSourceInstanceListFilters, UnstableGetDataSourceInstanceListFilters>>();
  });
});
