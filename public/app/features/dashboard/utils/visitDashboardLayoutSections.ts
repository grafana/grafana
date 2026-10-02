import { type Spec as DashboardV2Spec, type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

export type DashboardLayout = DashboardV2Spec['layout'];

interface SectionVariablesContext {
  path: string;
  /** Human-readable breadcrumb, e.g. `Row: Servers` or `Tab: Overview › Row: Metrics`. */
  scopeLabel: string;
}

export type SectionVariablesVisitor = (variables: VariableKind[], context: SectionVariablesContext) => void;

export type SectionVariablesMapper = (
  variables: VariableKind[] | undefined,
  context: SectionVariablesContext
) => VariableKind[] | undefined;

function sectionSegment(kind: 'row' | 'tab', index: number, title?: string): string {
  if (title?.trim()) {
    return kind === 'row' ? `Row: ${title.trim()}` : `Tab: ${title.trim()}`;
  }
  return kind === 'row' ? `Row ${index + 1}` : `Tab ${index + 1}`;
}

function appendScopeLabel(prefix: string, segment: string): string {
  return prefix ? `${prefix} › ${segment}` : segment;
}

/**
 * Recursively visit RowsLayout / TabsLayout sections and invoke the visitor
 * for each section that has a variables list.
 *
 * Paths look like `/rows/0`, `/tabs/1/rows/0`. GridLayout and AutoGridLayout are leaves.
 */
export function visitDashboardLayoutSections(
  layout: DashboardLayout | undefined,
  visitor: SectionVariablesVisitor,
  pathPrefix = '',
  scopeLabelPrefix = ''
): void {
  if (!layout) {
    return;
  }

  if (layout.kind === 'RowsLayout') {
    layout.spec.rows.forEach((row, index) => {
      if (row.kind !== 'RowsLayoutRow') {
        return;
      }
      const path = `${pathPrefix}/rows/${index}`;
      const scopeLabel = appendScopeLabel(scopeLabelPrefix, sectionSegment('row', index, row.spec.title));
      if (row.spec.variables) {
        visitor(row.spec.variables, { path, scopeLabel });
      }
      visitDashboardLayoutSections(row.spec.layout, visitor, path, scopeLabel);
    });
    return;
  }

  if (layout.kind === 'TabsLayout') {
    layout.spec.tabs.forEach((tab, index) => {
      if (tab.kind !== 'TabsLayoutTab') {
        return;
      }
      const path = `${pathPrefix}/tabs/${index}`;
      const scopeLabel = appendScopeLabel(scopeLabelPrefix, sectionSegment('tab', index, tab.spec.title));
      if (tab.spec.variables) {
        visitor(tab.spec.variables, { path, scopeLabel });
      }
      visitDashboardLayoutSections(tab.spec.layout, visitor, path, scopeLabel);
    });
  }
}

/**
 * Immutably map section variable lists under RowsLayout / TabsLayout.
 * Returns the original layout reference when nothing changes.
 */
export function mapDashboardLayoutSections(
  layout: DashboardLayout | undefined,
  mapper: SectionVariablesMapper,
  pathPrefix = '',
  scopeLabelPrefix = ''
): DashboardLayout | undefined {
  if (!layout) {
    return layout;
  }

  if (layout.kind === 'RowsLayout') {
    let modified = false;
    const rows = layout.spec.rows.map((row, index) => {
      if (row.kind !== 'RowsLayoutRow') {
        return row;
      }
      const path = `${pathPrefix}/rows/${index}`;
      const scopeLabel = appendScopeLabel(scopeLabelPrefix, sectionSegment('row', index, row.spec.title));
      const context: SectionVariablesContext = { path, scopeLabel };
      const mappedVariables = mapper(row.spec.variables, context);
      const nestedLayout = mapDashboardLayoutSections(row.spec.layout, mapper, path, scopeLabel) ?? row.spec.layout;
      const variablesChanged = mappedVariables !== row.spec.variables;
      const layoutChanged = nestedLayout !== row.spec.layout;

      if (!variablesChanged && !layoutChanged) {
        return row;
      }

      modified = true;
      return {
        ...row,
        spec: {
          ...row.spec,
          ...(variablesChanged ? { variables: mappedVariables } : {}),
          ...(layoutChanged ? { layout: nestedLayout } : {}),
        },
      };
    });

    return modified ? { ...layout, spec: { ...layout.spec, rows } } : layout;
  }

  if (layout.kind === 'TabsLayout') {
    let modified = false;
    const tabs = layout.spec.tabs.map((tab, index) => {
      if (tab.kind !== 'TabsLayoutTab') {
        return tab;
      }
      const path = `${pathPrefix}/tabs/${index}`;
      const scopeLabel = appendScopeLabel(scopeLabelPrefix, sectionSegment('tab', index, tab.spec.title));
      const context: SectionVariablesContext = { path, scopeLabel };
      const mappedVariables = mapper(tab.spec.variables, context);
      const nestedLayout = mapDashboardLayoutSections(tab.spec.layout, mapper, path, scopeLabel) ?? tab.spec.layout;
      const variablesChanged = mappedVariables !== tab.spec.variables;
      const layoutChanged = nestedLayout !== tab.spec.layout;

      if (!variablesChanged && !layoutChanged) {
        return tab;
      }

      modified = true;
      return {
        ...tab,
        spec: {
          ...tab.spec,
          ...(variablesChanged ? { variables: mappedVariables } : {}),
          ...(layoutChanged ? { layout: nestedLayout } : {}),
        },
      };
    });

    return modified ? { ...layout, spec: { ...layout.spec, tabs } } : layout;
  }

  return layout;
}
