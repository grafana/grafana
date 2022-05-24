import { QueryEditorProps } from '@grafana/data';

import { ElasticDatasource } from '../datasource';
import { ElasticsearchOptions, ElasticsearchQuery } from '../types';

export type SettingKeyOf<T extends { settings?: Record<string, unknown> }> = Extract<
  keyof NonNullable<T['settings']>,
  string
>;

export type ElasticsearchQueryEditorProps = QueryEditorProps<
  ElasticDatasource,
  ElasticsearchQuery,
  ElasticsearchOptions
>;
