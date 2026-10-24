import { isRecord } from 'app/core/utils/isRecord';

const GROUP_BY_VARIABLE_REPLACEMENT =
  'Use an AdhocVariable with spec.enableGroupBy: true to let users pick group-by keys; to apply a grouping, add a filter { key, operator: "groupBy", value: "" }.';

/**
 * GroupByVariable is still a kind in the v2 spec, so a stored dashboard can carry one: the loader merges it
 * into the adhoc variable on the same datasource, or drops it if there is none. Variable commands reject the
 * kind. APPLY_SPEC applies a spec that has one, since the spec is still valid, and warns.
 */
export const GROUP_BY_VARIABLE_UNSUPPORTED = `GroupByVariable is no longer supported. ${GROUP_BY_VARIABLE_REPLACEMENT}`;

export const GROUP_BY_VARIABLE_CONVERTED = `GroupByVariable is deprecated and was converted on load: merged as group by into the AdhocVariable on the same datasource, or dropped if there is none. ${GROUP_BY_VARIABLE_REPLACEMENT}`;

/**
 * Dot paths to the `kind` of every GroupByVariable among the spec's dashboard and section variables.
 * Only variable lists are inspected: a variable's query payload is opaque datasource data.
 */
export function findGroupByVariablePaths(spec: Record<string, unknown>): string[] {
  return [...findInVariables(spec.variables, ['variables']), ...findInLayout(spec.layout, ['layout'])];
}

function findInVariables(variables: unknown, path: Array<string | number>): string[] {
  if (!Array.isArray(variables)) {
    return [];
  }
  return variables.flatMap((variable, index) =>
    isRecord(variable) && variable.kind === 'GroupByVariable' ? [[...path, index, 'kind'].join('.')] : []
  );
}

// Section variables live on rows and tabs, which can nest through their own `layout`.
function findInLayout(layout: unknown, path: Array<string | number>): string[] {
  const layoutSpec = isRecord(layout) ? layout.spec : undefined;
  if (!isRecord(layoutSpec)) {
    return [];
  }
  return ['rows', 'tabs'].flatMap((sectionsKey) => {
    const sections = layoutSpec[sectionsKey];
    if (!Array.isArray(sections)) {
      return [];
    }
    return sections.flatMap((section, index) => {
      const sectionSpec = isRecord(section) ? section.spec : undefined;
      if (!isRecord(sectionSpec)) {
        return [];
      }
      const sectionPath = [...path, 'spec', sectionsKey, index, 'spec'];
      return [
        ...findInVariables(sectionSpec.variables, [...sectionPath, 'variables']),
        ...findInLayout(sectionSpec.layout, [...sectionPath, 'layout']),
      ];
    });
  });
}
