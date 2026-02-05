import { IconName } from '@grafana/data';
import { t } from '@grafana/i18n';

export enum QueryEditorType {
  Query = 'query',
  Expression = 'expression',
  Transformation = 'transformation',
}

export enum SidebarSize {
  Mini = 'mini',
  Full = 'full',
}

export interface QueryEditorTypeConfig {
  icon: IconName;
  color: string;
  getLabel: () => string;
}

export const QUERY_EDITOR_TYPE_CONFIG: Record<QueryEditorType, QueryEditorTypeConfig> = {
  [QueryEditorType.Query]: {
    icon: 'database',
    color: '#FF8904',
    getLabel: () => t('query-editor-next.labels.query', 'Query'),
  },
  [QueryEditorType.Expression]: {
    icon: 'calculator-alt',
    color: '#C27AFF',
    getLabel: () => t('query-editor-next.labels.expression', 'Expression'),
  },
  [QueryEditorType.Transformation]: {
    icon: 'process',
    color: '#00D492',
    getLabel: () => t('query-editor-next.labels.transformation', 'Transformation'),
  },
} as const;

/**
 * Default placeholder for time-related inputs (relative time, time shift).
 * This is a common example value shown when no value is set.
 */
export const TIME_OPTION_PLACEHOLDER = '1h';

export const CONTENT_SIDE_BAR = {
  width: 300,
  labelWidth: 80,
};
