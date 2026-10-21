import { findGroupByVariablePaths } from './deprecatedGroupByVariable';

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

describe('findGroupByVariablePaths', () => {
  it('finds a dashboard-level GroupByVariable', () => {
    expect(findGroupByVariablePaths({ variables: [{ kind: 'CustomVariable', spec: {} }, groupBy] })).toEqual([
      'variables.1.kind',
    ]);
  });

  it('finds one in a tab nested in a row', () => {
    const spec = {
      variables: [],
      layout: rows({ title: 'Row', layout: tabs({ title: 'Tab', variables: [groupBy], layout: grid() }) }),
    };

    expect(findGroupByVariablePaths(spec)).toEqual([
      'layout.spec.rows.0.spec.layout.spec.tabs.0.spec.variables.0.kind',
    ]);
  });

  it('finds one in a top-level tab', () => {
    const spec = { variables: [], layout: tabs({ title: 'Tab', variables: [groupBy], layout: grid() }) };

    expect(findGroupByVariablePaths(spec)).toEqual(['layout.spec.tabs.0.spec.variables.0.kind']);
  });

  it('finds one in a row nested in a tab', () => {
    const spec = {
      variables: [],
      layout: tabs({ title: 'Tab', layout: rows({ title: 'Row', variables: [groupBy], layout: grid() }) }),
    };

    expect(findGroupByVariablePaths(spec)).toEqual([
      'layout.spec.tabs.0.spec.layout.spec.rows.0.spec.variables.0.kind',
    ]);
  });

  it('collects every one, at dashboard and section level', () => {
    const spec = {
      variables: [groupBy, { kind: 'CustomVariable', spec: {} }, groupBy],
      layout: rows({ title: 'Row', variables: [groupBy], layout: grid() }),
    };

    expect(findGroupByVariablePaths(spec)).toEqual([
      'variables.0.kind',
      'variables.2.kind',
      'layout.spec.rows.0.spec.variables.0.kind',
    ]);
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

    expect(findGroupByVariablePaths(spec)).toEqual([]);
  });

  it('only looks at variable lists in the layout', () => {
    const spec = { variables: [], layout: grid([{ kind: 'GridLayoutItem', spec: { nested: groupBy } }]) };

    expect(findGroupByVariablePaths(spec)).toEqual([]);
  });
});
