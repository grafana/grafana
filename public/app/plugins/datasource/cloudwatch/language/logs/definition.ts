import { LanguageDefinition } from '../monarch/register';

export const CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID = 'cloudwatch-logs';

const cloudWatchLogsLanguageDefinition: LanguageDefinition = {
  id: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID,
  extensions: [],
  aliases: [],
  mimetypes: [],
  loader: () => import('./language'),
};
export default cloudWatchLogsLanguageDefinition;
