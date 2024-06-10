import { language, languageConfiguration } from './pyroscopeql';

export const languageDefinition = {
  id: 'pyroscopeql',
  extensions: ['.pyroscopeql'],
  aliases: ['pyroscope', 'pyroscopeql'],
  mimetypes: [],
  def: {
    language,
    languageConfiguration,
  },
};
