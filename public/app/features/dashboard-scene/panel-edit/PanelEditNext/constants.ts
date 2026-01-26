import { IconName } from '@grafana/data';

export enum QueryEditorType {
  Query = 'query',
  Expression = 'expression',
  Transformation = 'transformation',
}

export interface QueryEditorTypeConfig {
  icon: IconName;
  color: string;
  label: string;
}

export const QUERY_EDITOR_TYPE_CONFIG: Record<QueryEditorType, QueryEditorTypeConfig> = {
  [QueryEditorType.Query]: {
    icon: 'database',
    color: '#FF8904',
    label: 'Query',
  },
  [QueryEditorType.Expression]: {
    icon: 'brackets-curly',
    color: '#C27AFF',
    label: 'Expression',
  },
  [QueryEditorType.Transformation]: {
    icon: 'process',
    color: '#00D492',
    label: 'Transformation',
  },
} as const;
