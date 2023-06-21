import { LanguageDefinition } from '../monarch/register';

const cloudWatchLogsLanguageDefinition: LanguageDefinition = {
  id: 'logs',
  extensions: [],
  aliases: [],
  mimetypes: [],
  loader: () => import('./language'),
};
export default cloudWatchLogsLanguageDefinition;
