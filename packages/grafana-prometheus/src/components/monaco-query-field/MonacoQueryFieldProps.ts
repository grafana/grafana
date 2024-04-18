// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/components/monaco-query-field/MonacoQueryFieldProps.ts
import { HistoryItem } from '@grafana/data';

import { PrometheusDatasource } from '../../datasource';
import type PromQlLanguageProvider from '../../language_provider';
import { PromQuery } from '../../types';

// we need to store this in a separate file,
// because we have an async-wrapper around,
// the react-component, and it needs the same
// props as the sync-component.
export type Props = {
  initialValue: string;
  languageProvider: PromQlLanguageProvider;
  history: Array<HistoryItem<PromQuery>>;
  placeholder: string;
  onRunQuery: (value: string) => void;
  onBlur: (value: string) => void;
  // onChange will never initiate a query, it just denotes that a query value has been changed
  onChange: (value: string) => void;
  datasource: PrometheusDatasource;
};
