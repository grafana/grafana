import { monacoTypes } from '@grafana/ui';

import { SQLMonarchLanguage } from './types';

export type LanguageDefinition = {
  id: string;
  extensions: string[];
  aliases: string[];
  mimetypes: string[];
  loader: (monaco: any) => Promise<{
    language: SQLMonarchLanguage;
    conf: monacoTypes.languages.LanguageConfiguration;
  }>;
};

const standardSQLLanguageDefinition: LanguageDefinition = {
  id: 'standardSql',
  extensions: ['.sql'],
  aliases: ['sql'],
  mimetypes: [],
  loader: () => import('./language'),
};

export default standardSQLLanguageDefinition;
