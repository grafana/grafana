import { LanguageDefinition } from '../monarch/register';

import { CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID } from './language';

const cloudWatchPPLLanguageDefinition: LanguageDefinition = {
  id: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID,
  extensions: [],
  aliases: [],
  mimetypes: [],
  loader: () => import('./language'),
};
export default cloudWatchPPLLanguageDefinition;
