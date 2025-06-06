import { TemplateSrv } from '@grafana/runtime';

import { LogGroup } from '../dataquery.gen';
import { ResourcesAPI } from '../resources/ResourcesAPI';
import { interpolateStringArrayUsingSingleOrMultiValuedVariable } from '../utils/templateVariableUtils';

export const fetchLogGroupFields = async (
  logGroups: LogGroup[],
  region: string,
  templateSrv: TemplateSrv,
  resources: ResourcesAPI
): Promise<string[]> => {
  if (logGroups.length === 0) {
    return [];
  }

  const interpolatedLogGroups = interpolateStringArrayUsingSingleOrMultiValuedVariable(
    templateSrv,
    logGroups.map((lg) => lg.name),
    {},
    'text'
  );

  const results = await Promise.all(
    interpolatedLogGroups.map((logGroupName) =>
      resources
        .getLogGroupFields(region, logGroupName)
        .then((fields) => fields.filter((f) => f).map((f) => f.value.name ?? ''))
    )
  );
  // Deduplicate fields
  return [...new Set(results.flat())];
};
