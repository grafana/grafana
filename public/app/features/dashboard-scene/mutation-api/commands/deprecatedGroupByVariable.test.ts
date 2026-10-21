import { findGroupByVariablePath } from './deprecatedGroupByVariable';

const groupBy = { kind: 'GroupByVariable', group: 'prometheus', spec: { name: 'groupBy' } };

function grid(items: unknown[] = []) {
  return { kind: 'GridLayout', spec: { items } };
}

function rows(...sectionSpecs: Array<Record<string, unknown>>) {
  return { kind: 'RowsLayout', spec: { rows: sectionSpecs.map((spec) => ({ kind: 'RowsLayoutRow', spec })) } };
}

function tabs(...sectionSpecs: Array<Record<string, unknown>>) {
  return { kind: 'TabsLayout', spec: { tabs: sectionSpecs.map((spec) => ({ kind: 'TabsLayoutTab', spec })) } };
}

describe('findGroupByVariablePath', () => {
  it('finds a dashboard-level GroupByVariable', () => {
    expect(findGroupByVariablePath({ variables: [{ kind: 'CustomVariable', spec: {} }, groupBy] })).toBe(
      'variables.1.kind'
    );
  });

  it('finds one in a tab nested in a row', () => {
    const spec = {
      variables: [],
      layout: rows({ title: 'Row', layout: tabs({ title: 'Tab', variables: [groupBy], layout: grid() }) }),
    };

    expect(findGroupByVariablePath(spec)).toBe('layout.spec.rows.0.spec.layout.spec.tabs.0.spec.variables.0.kind');
  });

  it('ignores the kind inside a variable query, which is opaque datasource data', () => {
    const queryVariable = {
      kind: 'QueryVariable',
      spec: { name: 'q', query: { kind: 'DataQuery', group: 'some-plugin', spec: { nested: groupBy } } },
    };
    const spec = {
      variables: [queryVariable],
      layout: rows({ title: 'Row', variables: [queryVariable], layout: grid() }),
    };

    expect(findGroupByVariablePath(spec)).toBeUndefined();
  });

  it('only looks at variable lists in the layout', () => {
    const spec = { variables: [], layout: grid([{ kind: 'GridLayoutItem', spec: { nested: groupBy } }]) };

    expect(findGroupByVariablePath(spec)).toBeUndefined();
  });
});
