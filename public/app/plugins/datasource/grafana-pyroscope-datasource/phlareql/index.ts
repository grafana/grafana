import { language, languageConfiguration } from './phlareql';

export const languageDefinition = {
  id: 'phlareql',
  extensions: ['.phlareql'],
  aliases: ['phlare', 'phlareql'],
  mimetypes: [],
  def: {
    language,
    languageConfiguration,
  },
};
