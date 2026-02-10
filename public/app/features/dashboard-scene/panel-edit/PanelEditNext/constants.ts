import { IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ExpressionQueryType } from 'app/features/expressions/types';

import { QueryOptionField } from './QueryEditor/types';

export enum QueryEditorType {
  Query = 'query',
  Expression = 'expression',
  Transformation = 'transformation',
}

export enum SidebarSize {
  Mini = 'mini',
  Full = 'full',
}

export const QUERY_EDITOR_COLORS = {
  footerBackground: '#1e2939',
  query: '#FF8904',
  expression: '#C27AFF',
  transformation: '#00D492',
};

export interface QueryEditorTypeConfig {
  __type__: QueryEditorType;
  icon: IconName;
  color: string;
  getLabel: () => string;
}

export const QUERY_EDITOR_TYPE_CONFIG: Record<QueryEditorType, QueryEditorTypeConfig> = {
  [QueryEditorType.Query]: {
    __type__: QueryEditorType.Query,
    icon: 'database',
    color: QUERY_EDITOR_COLORS.query,
    getLabel: () => t('query-editor-next.labels.query', 'Query'),
  },
  [QueryEditorType.Expression]: {
    __type__: QueryEditorType.Expression,
    icon: 'calculator-alt',
    color: QUERY_EDITOR_COLORS.expression,
    getLabel: () => t('query-editor-next.labels.expression', 'Expression'),
  },
  [QueryEditorType.Transformation]: {
    __type__: QueryEditorType.Transformation,
    icon: 'process',
    color: QUERY_EDITOR_COLORS.transformation,
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
} as const;

export interface QueryOptionFieldConfig {
  getTooltip: () => string;
  getLabel: () => string;
  placeholder?: string;
  inputType?: 'text' | 'number';
}

export const QUERY_OPTION_FIELD_CONFIG: Record<QueryOptionField, QueryOptionFieldConfig> = {
  [QueryOptionField.maxDataPoints]: {
    getTooltip: () =>
      t(
        'query-editor-next.details-sidebar.max-data-points-tooltip',
        'The maximum data points per series. Used directly by some data sources and used in calculation of auto interval.'
      ),
    getLabel: () => t('query-editor-next.details-sidebar.max-data-points', 'Max data points'),
    inputType: 'number',
  },
  [QueryOptionField.minInterval]: {
    getTooltip: () =>
      t(
        'query-editor-next.details-sidebar.min-interval-tooltip',
        'A lower limit for the interval. Recommended to be set to write frequency, for example 1m if your data is written every minute.'
      ),
    getLabel: () => t('query-editor-next.details-sidebar.min-interval', 'Min interval'),
  },
  [QueryOptionField.interval]: {
    getTooltip: () =>
      t(
        'query-editor-next.details-sidebar.interval-tooltip',
        'The evaluated interval that is sent to data source and is used in $__interval and $__interval_ms.'
      ),
    getLabel: () => t('query-editor-next.details-sidebar.interval', 'Interval'),
  },
  [QueryOptionField.relativeTime]: {
    getTooltip: () =>
      t(
        'query-editor-next.details-sidebar.relative-time-tooltip',
        'Overrides the relative time range for individual panels. For example, to configure the Last 5 minutes use now-5m.'
      ),
    getLabel: () => t('query-editor-next.details-sidebar.relative-time', 'Relative time'),
    placeholder: TIME_OPTION_PLACEHOLDER,
  },
  [QueryOptionField.timeShift]: {
    getTooltip: () =>
      t(
        'query-editor-next.details-sidebar.time-shift-tooltip',
        'Overrides the time range for individual panels by shifting its start and end relative to the time picker.'
      ),
    getLabel: () => t('query-editor-next.details-sidebar.time-shift', 'Time shift'),
    placeholder: TIME_OPTION_PLACEHOLDER,
  },
  [QueryOptionField.cacheTimeout]: {
    getTooltip: () =>
      t(
        'query-editor-next.details-sidebar.cache-timeout-tooltip',
        'If your time series store has a query cache this option can override the default cache timeout. Specify a numeric value in seconds.'
      ),
    getLabel: () => t('query-editor-next.details-sidebar.cache-timeout', 'Cache timeout'),
    placeholder: '60',
  },
  [QueryOptionField.queryCachingTTL]: {
    getTooltip: () =>
      t(
        'query-editor-next.details-sidebar.cache-ttl-tooltip',
        'Cache time-to-live: How long results from the queries in this panel will be cached, in milliseconds.'
      ),
    getLabel: () => t('query-editor-next.details-sidebar.cache-ttl', 'Cache TTL'),
    inputType: 'number',
  },
};

export const EXPRESSION_ICON_MAP = {
  [ExpressionQueryType.math]: 'calculator-alt',
  [ExpressionQueryType.reduce]: 'compress-arrows',
  [ExpressionQueryType.resample]: 'sync',
  [ExpressionQueryType.classic]: 'cog',
  [ExpressionQueryType.threshold]: 'sliders-v-alt',
  [ExpressionQueryType.sql]: 'database',
} as const satisfies Record<ExpressionQueryType, string>;

export const QUERY_EDITOR_TYPE_HAS_ADD_BUTTON: Record<QueryEditorType, boolean> = {
  [QueryEditorType.Query]: true,
  [QueryEditorType.Expression]: true,
  [QueryEditorType.Transformation]: false,
};
