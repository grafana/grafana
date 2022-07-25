import { LanguageDefinition } from '../monarch/register';

const cloudWatchDynamicLabelsLanguageDefinition: LanguageDefinition = {
  id: 'cloudwatch-dynamicLabels',
  extensions: [],
  aliases: [],
  mimetypes: [],
  loader: () => import('./language'),
};
export default cloudWatchDynamicLabelsLanguageDefinition;
