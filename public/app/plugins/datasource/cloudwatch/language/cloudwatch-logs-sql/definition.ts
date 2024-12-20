import { LanguageDefinition } from '../monarch/register';

export const CLOUDWATCH_LOGS_SQL_LANGUAGE_DEFINITION_ID = 'cloudwatch-logs-sql';

const cloudWatchLogsSqlLanguageDefinition: LanguageDefinition = {
  id: CLOUDWATCH_LOGS_SQL_LANGUAGE_DEFINITION_ID,
  extensions: [],
  aliases: [],
  mimetypes: [],
  loader: () => import('./language'),
};
export default cloudWatchLogsSqlLanguageDefinition;
