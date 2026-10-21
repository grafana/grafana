/**
 * GroupByVariable is still a kind in the v2 spec, so a stored dashboard can carry one (the loader
 * merges it into the adhoc variable on the same datasource). Mutation API callers must not author new
 * ones: commands reject the kind and point to its replacement.
 */
export const GROUP_BY_VARIABLE_UNSUPPORTED =
  'GroupByVariable is no longer supported. Use an AdhocVariable with spec.enableGroupBy: true to let users pick group-by keys; to apply a grouping, add a filter { key, operator: "groupBy", value: "" }.';

/** Dot path to the `kind` of the first GroupByVariable among the spec's dashboard or section variables. */
export function findGroupByVariablePath(spec: Record<string, unknown>): string | undefined {
  return findGroupByKind(spec.variables, ['variables']) ?? findGroupByKind(spec.layout, ['layout']);
}

function findGroupByKind(value: unknown, path: Array<string | number>): string | undefined {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = findGroupByKind(item, [...path, index]);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  if ('kind' in value && value.kind === 'GroupByVariable') {
    return [...path, 'kind'].join('.');
  }

  for (const [key, child] of Object.entries(value)) {
    const found = findGroupByKind(child, [...path, key]);
    if (found) {
      return found;
    }
  }
  return undefined;
}
