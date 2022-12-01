import { HistoryItem } from '@grafana/data';

import type LanguageProvider from '../../LanguageProvider';
import { LokiQuery } from '../../types';

// we need to store this in a separate file,
// because we have an async-wrapper around,
// the react-component, and it needs the same
// props as the sync-component.
export type Props = {
  initialValue: string;
  languageProvider: LanguageProvider;
  history: Array<HistoryItem<LokiQuery>>;
  onRunQuery: (value: string) => void;
  onBlur: (value: string) => void;
};
