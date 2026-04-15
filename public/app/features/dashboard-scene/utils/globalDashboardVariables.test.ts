import { defaultCustomVariableKind, defaultQueryVariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import {
  mergeDefaultVariableKinds,
  sortGlobalAndDatasourceDefaultVariables,
  tagVariableKindAsGlobalDefault,
} from './globalDashboardVariables';


describe('globalDashboardVariables', () => {
  it('tagVariableKindAsGlobalDefault sets globalvariable origin', () => {
    const v = defaultCustomVariableKind();
    v.spec.name = 'region';
    const tagged = tagVariableKindAsGlobalDefault(v, 'org');
    expect(tagged.spec.origin).toEqual({ type: 'globalvariable', group: 'org' });
  });

  it('sortGlobalAndDatasourceDefaultVariables sorts datasource before globalvariable', () => {
    const g = tagVariableKindAsGlobalDefault(defaultCustomVariableKind(), 'org');
    g.spec.name = 'g';

    const d = defaultQueryVariableKind();
    d.spec.name = 'd';
    d.spec.origin = { type: 'datasource', group: 'prometheus' };

    const sorted = sortGlobalAndDatasourceDefaultVariables([g, d]);
    expect(sorted[0].spec.name).toBe('d');
    expect(sorted[1].spec.name).toBe('g');
  });

  it('mergeDefaultVariableKinds appends and sorts', () => {
    const existing = defaultQueryVariableKind();
    existing.spec.name = 'ds';
    existing.spec.origin = { type: 'datasource', group: 'loki' };

    const global = tagVariableKindAsGlobalDefault(defaultCustomVariableKind(), 'org');
    global.spec.name = 'gv';

    const merged = mergeDefaultVariableKinds([existing], [global]);
    expect(merged.map((v) => v.spec.name)).toEqual(['ds', 'gv']);
  });
});
