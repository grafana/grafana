import { language, languageConfiguration } from './fireql';

export const languageDefinition = {
  id: 'fireql',
  extensions: ['.fireql'],
  aliases: ['fire', 'fireql'],
  mimetypes: [],
  def: {
    language,
    languageConfiguration,
  },
};
