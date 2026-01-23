import { IconName } from '@grafana/data';

export enum QueryEditorType {
  Query = 'query',
  Expression = 'expression',
  Transformation = 'transformation',
}

export const QUERY_EDITOR_TYPE_CONFIG: Record<
  QueryEditorType,
  {
    icon: IconName;
    color: string;
  }
> = {
  [QueryEditorType.Query]: {
    icon: 'database',
    color: '#FF8904',
  },
  [QueryEditorType.Expression]: {
    icon: 'code',
    color: '#C27AFF',
  },
  [QueryEditorType.Transformation]: {
    icon: 'pivot',
    color: '#00D492',
  },
} as const;
