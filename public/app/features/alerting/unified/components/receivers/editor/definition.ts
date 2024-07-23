import { LanguageDefinition } from './register';

export const GO_TEMPLATE_LANGUAGE_ID = 'go-template';
export const JSONNET_LANGUAGE_ID = 'jsonnet';

export const goTemplateLanguageDefinition: LanguageDefinition = {
  id: GO_TEMPLATE_LANGUAGE_ID,
  extensions: [],
  aliases: [],
  mimetypes: [],
  loader: () => import('./language'),
};
export default goTemplateLanguageDefinition;

export const jsonnetLanguageDefinition: LanguageDefinition = {
  id: JSONNET_LANGUAGE_ID,
  extensions: [],
  aliases: [],
  mimetypes: [],
  loader: () => import('./jsonnetLanguage'),
};
