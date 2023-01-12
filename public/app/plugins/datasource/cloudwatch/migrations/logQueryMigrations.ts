import { CloudWatchAPI } from '../api';
import { LogGroup } from '../types';
import { isTemplateVariable } from '../utils/templateVariableUtils';

export const migrateLegacyLogGroupName = (
  legacyLogGroupNames: string[],
  region: string,
  api: CloudWatchAPI
): Promise<LogGroup[]> => {
  const variables = legacyLogGroupNames.filter((lgn) => isTemplateVariable(api.templateSrv, lgn));
  const legacyLogGroupNameValues = legacyLogGroupNames.filter((lgn) => !isTemplateVariable(api.templateSrv, lgn));

  return Promise.all(legacyLogGroupNameValues.map((lg) => api.getLogGroups({ region: region, logGroupNamePrefix: lg })))
    .then((results) => {
      const logGroups = results.flatMap((r) =>
        r.map((lg) => ({
          arn: lg.value.arn,
          name: lg.value.name,
          accountId: lg.accountId,
        }))
      );

      return [...logGroups, ...variables.map((v) => ({ name: v, arn: v }))];
    })
    .catch((err) => {
      console.error(err);
      return [];
    });
};
