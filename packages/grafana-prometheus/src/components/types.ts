// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/components/types.ts
import { QueryEditorProps } from '@grafana/data';

import { PrometheusDatasource } from '../datasource';
import { PromOptions, PromQuery } from '../types';

export type PromQueryEditorProps = QueryEditorProps<PrometheusDatasource, PromQuery, PromOptions>;
