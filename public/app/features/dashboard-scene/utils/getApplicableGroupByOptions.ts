import { GroupByVariable, SceneDataQuery, VariableValueOption } from '@grafana/scenes';

export async function getApplicableGroupByOptions(
  groupByVariable: GroupByVariable,
  options: VariableValueOption[],
  queries: SceneDataQuery[]
) {
  if (!options.length) {
    return [];
  }

  if (!queries.length) {
    return options;
  }

  const values = options.map((option) => option.value);
  const applicability = await groupByVariable.getGroupByApplicabilityForQueries(values, queries);

  return applicability?.length
    ? applicability.filter((item) => item.applicable).map((item) => ({ label: item.key, value: item.key }))
    : options;
}
