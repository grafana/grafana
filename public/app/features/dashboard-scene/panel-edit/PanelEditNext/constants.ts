import { IconName } from '@grafana/data';

export type QueryEditorType = 'query' | 'expression' | 'transformation';
export const QUERY_EDITOR_TYPE_CONFIG: Record<
  QueryEditorType,
  {
    icon: IconName;
    color: string;
  }
> = {
  query: {
    icon: 'database',
    color: '#FF8904',
  },
  expression: {
    icon: 'code',
    color: '#C27AFF',
  },
  transformation: {
    icon: 'pivot',
    color: '#00D492',
  },
} as const;
