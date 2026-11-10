import { isRecord } from 'app/core/utils/isRecord';

/**
 * GroupByVariable is still a kind in the v2 spec, so a stored dashboard can carry one: the loader merges it
 * into the adhoc variable on the same datasource, or drops it if there is none. Mutation API callers must not
 * author new ones: commands reject the kind and point to its replacement. That includes APPLY_SPEC: GET_SPEC
 * returns the loaded dashboard, which never has one, so a GroupByVariable in an applied spec came from the caller.
 */
export const GROUP_BY_VARIABLE_UNSUPPORTED =
  'GroupByVariable is no longer supported. Use an AdhocVariable with spec.enableGroupBy: true to let users pick group-by keys; to apply a grouping, add a filter { key, operator: "groupBy", value: "" }.';

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
