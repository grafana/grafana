import type { QueryEditorProps } from '@grafana/data/types';

import { type LokiDatasource } from '../datasource';
import { type LokiOptions, type LokiQuery } from '../types';

export type LokiQueryEditorProps = QueryEditorProps<LokiDatasource, LokiQuery, LokiOptions>;
