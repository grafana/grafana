import {
  type VariableKind,
  defaultGridLayoutKind,
  defaultRowsLayoutKind,
  defaultTabsLayoutKind,
  defaultAutoGridLayoutKind,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { mapDashboardLayoutSections, visitDashboardLayoutSections } from './visitDashboardLayoutSections';

const makeConstant = (name: string): VariableKind => ({
  kind: 'ConstantVariable',
  spec: {
    name,
    query: name,
    current: { text: name, value: name },
    hide: 'dontHide',
    skipUrlSync: false,
  },
});

describe('visitDashboardLayoutSections', () => {
  it('does nothing for GridLayout', () => {
    const visitor = jest.fn();
    visitDashboardLayoutSections(defaultGridLayoutKind(), visitor);
    expect(visitor).not.toHaveBeenCalled();
  });

  it('does nothing for AutoGridLayout', () => {
    const visitor = jest.fn();
    visitDashboardLayoutSections(defaultAutoGridLayoutKind(), visitor);
    expect(visitor).not.toHaveBeenCalled();
  });

  it('visits row section variables with path', () => {
    const variables = [makeConstant('env')];
    const layout = defaultRowsLayoutKind();
    layout.spec.rows = [
      {
        kind: 'RowsLayoutRow',
        spec: { title: 'Row 1', layout: defaultGridLayoutKind(), variables },
      },
    ];

    const visitor = jest.fn();
    visitDashboardLayoutSections(layout, visitor);

    expect(visitor).toHaveBeenCalledTimes(1);
    expect(visitor).toHaveBeenCalledWith(variables, '/rows/0');
  });

  it('visits tab section variables with path', () => {
    const variables = [makeConstant('region')];
    const layout = defaultTabsLayoutKind();
    layout.spec.tabs = [
      {
        kind: 'TabsLayoutTab',
        spec: { title: 'Tab 1', layout: defaultGridLayoutKind(), variables },
      },
    ];

    const visitor = jest.fn();
    visitDashboardLayoutSections(layout, visitor);

    expect(visitor).toHaveBeenCalledTimes(1);
    expect(visitor).toHaveBeenCalledWith(variables, '/tabs/0');
  });

  it('visits nested TabsLayout > RowsLayout sections', () => {
    const tabVariables = [makeConstant('tabConst')];
    const rowVariables = [makeConstant('rowConst')];
    const rowsLayout = defaultRowsLayoutKind();
    rowsLayout.spec.rows = [
      {
        kind: 'RowsLayoutRow',
        spec: { title: 'Row 1', layout: defaultGridLayoutKind(), variables: rowVariables },
      },
    ];
    const tabsLayout = defaultTabsLayoutKind();
    tabsLayout.spec.tabs = [
      {
        kind: 'TabsLayoutTab',
        spec: { title: 'Tab 1', layout: rowsLayout, variables: tabVariables },
      },
    ];

    const visited: Array<{ path: string; names: string[] }> = [];
    visitDashboardLayoutSections(tabsLayout, (variables, path) => {
      visited.push({ path, names: variables.map((v) => v.spec.name) });
    });

    expect(visited).toEqual([
      { path: '/tabs/0', names: ['tabConst'] },
      { path: '/tabs/0/rows/0', names: ['rowConst'] },
    ]);
  });

  it('skips sections without variables', () => {
    const layout = defaultRowsLayoutKind();
    layout.spec.rows = [
      { kind: 'RowsLayoutRow', spec: { title: 'Empty', layout: defaultGridLayoutKind() } },
      {
        kind: 'RowsLayoutRow',
        spec: { title: 'With vars', layout: defaultGridLayoutKind(), variables: [makeConstant('x')] },
      },
    ];

    const visitor = jest.fn();
    visitDashboardLayoutSections(layout, visitor);

    expect(visitor).toHaveBeenCalledTimes(1);
    expect(visitor.mock.calls[0][1]).toBe('/rows/1');
  });
});

describe('mapDashboardLayoutSections', () => {
  it('returns the same layout reference when mapper is a no-op', () => {
    const variables = [makeConstant('env')];
    const layout = defaultRowsLayoutKind();
    layout.spec.rows = [
      {
        kind: 'RowsLayoutRow',
        spec: { title: 'Row 1', layout: defaultGridLayoutKind(), variables },
      },
    ];

    const result = mapDashboardLayoutSections(layout, (vars) => vars);
    expect(result).toBe(layout);
  });

  it('replaces section variables immutably', () => {
    const layout = defaultRowsLayoutKind();
    layout.spec.rows = [
      {
        kind: 'RowsLayoutRow',
        spec: {
          title: 'Row 1',
          layout: defaultGridLayoutKind(),
          variables: [makeConstant('env')],
        },
      },
    ];

    const result = mapDashboardLayoutSections(layout, (variables): VariableKind[] | undefined => {
      if (!variables) {
        return variables;
      }
      return variables.map(
        (v): VariableKind =>
          v.kind === 'ConstantVariable'
            ? { ...v, spec: { ...v.spec, query: 'staging', current: { text: 'staging', value: 'staging' } } }
            : v
      );
    });

    expect(result).toBeDefined();
    expect(result).not.toBe(layout);
    if (!result || result.kind !== 'RowsLayout') {
      return;
    }
    const mappedVar = result.spec.rows[0].spec.variables?.[0];
    expect(mappedVar?.kind).toBe('ConstantVariable');
    if (mappedVar?.kind !== 'ConstantVariable') {
      return;
    }
    expect(mappedVar.spec.query).toBe('staging');
    // original unchanged
    const originalVar = layout.spec.rows[0].spec.variables?.[0];
    expect(originalVar?.kind).toBe('ConstantVariable');
    if (originalVar?.kind !== 'ConstantVariable') {
      return;
    }
    expect(originalVar.spec.query).toBe('env');
  });

  it('maps nested TabsLayout > RowsLayout variables', () => {
    const rowsLayout = defaultRowsLayoutKind();
    rowsLayout.spec.rows = [
      {
        kind: 'RowsLayoutRow',
        spec: {
          title: 'Row 1',
          layout: defaultGridLayoutKind(),
          variables: [makeConstant('rowConst')],
        },
      },
    ];
    const tabsLayout = defaultTabsLayoutKind();
    tabsLayout.spec.tabs = [
      {
        kind: 'TabsLayoutTab',
        spec: {
          title: 'Tab 1',
          layout: rowsLayout,
          variables: [makeConstant('tabConst')],
        },
      },
    ];

    const result = mapDashboardLayoutSections(tabsLayout, (variables): VariableKind[] | undefined => {
      if (!variables) {
        return variables;
      }
      return variables.map(
        (v): VariableKind =>
          v.kind === 'ConstantVariable' ? { ...v, spec: { ...v.spec, name: `${v.spec.name}-mapped` } } : v
      );
    });

    expect(result).toBeDefined();
    if (!result || result.kind !== 'TabsLayout') {
      return;
    }
    expect(result.spec.tabs[0].spec.variables?.[0].spec.name).toBe('tabConst-mapped');
    const nestedRows = result.spec.tabs[0].spec.layout;
    expect(nestedRows.kind).toBe('RowsLayout');
    if (nestedRows.kind !== 'RowsLayout') {
      return;
    }
    expect(nestedRows.spec.rows[0].spec.variables?.[0].spec.name).toBe('rowConst-mapped');
  });
});
