import { isRecord } from 'app/core/utils/isRecord';

/**
 * GroupByVariable is still a kind in the v2 spec, so a stored dashboard can carry one (the loader
 * merges it into the adhoc variable on the same datasource). Mutation API callers must not author new
 * ones: commands reject the kind and point to its replacement.
 */
export const GROUP_BY_VARIABLE_UNSUPPORTED =
  'GroupByVariable is no longer supported. Use an AdhocVariable with spec.enableGroupBy: true to let users pick group-by keys; to apply a grouping, add a filter { key, operator: "groupBy", value: "" }.';

/**
 * Dot path to the `kind` of the first GroupByVariable among the spec's dashboard or section variables.
 * Only variable lists are inspected: a variable's query payload is opaque datasource data.
 */
export function findGroupByVariablePath(spec: Record<string, unknown>): string | undefined {
  return findInVariables(spec.variables, ['variables']) ?? findInLayout(spec.layout, ['layout']);
}

function findInVariables(variables: unknown, path: Array<string | number>): string | undefined {
  if (!Array.isArray(variables)) {
    return undefined;
  }
  const index = variables.findIndex((variable) => isRecord(variable) && variable.kind === 'GroupByVariable');
  return index === -1 ? undefined : [...path, index, 'kind'].join('.');
}

// Section variables live on rows and tabs, which can nest through their own `layout`.
function findInLayout(layout: unknown, path: Array<string | number>): string | undefined {
  if (!isRecord(layout) || !isRecord(layout.spec)) {
    return undefined;
  }
  for (const sectionsKey of ['rows', 'tabs']) {
    const sections = layout.spec[sectionsKey];
    if (!Array.isArray(sections)) {
      continue;
    }
    for (const [index, section] of sections.entries()) {
      if (!isRecord(section) || !isRecord(section.spec)) {
        continue;
      }
      const sectionPath = [...path, 'spec', sectionsKey, index, 'spec'];
      const found =
        findInVariables(section.spec.variables, [...sectionPath, 'variables']) ??
        findInLayout(section.spec.layout, [...sectionPath, 'layout']);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}
