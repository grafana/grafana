import { LanguageDefinition } from './register';

export const GO_TEMPLATE_LANGUAGE_ID = 'go-template';

const goTemplateLanguageDefinition: LanguageDefinition = {
  id: GO_TEMPLATE_LANGUAGE_ID,
  extensions: [],
  aliases: [],
  mimetypes: [],
  loader: () => import('./language'),
};
export default goTemplateLanguageDefinition;
