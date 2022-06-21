import { QueryEditorProps } from '@grafana/data';

import { PrometheusDatasource } from '../datasource';
import { PromOptions, PromQuery } from '../types';

export type PromQueryEditorProps = QueryEditorProps<PrometheusDatasource, PromQuery, PromOptions>;
