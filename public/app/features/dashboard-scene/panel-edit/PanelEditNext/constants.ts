import { AlertState, GrafanaTheme2, IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import classicConditionDarkImage from 'app/features/expressions/images/dark/classicCondition.svg';
import mathDarkImage from 'app/features/expressions/images/dark/math.svg';
import reduceDarkImage from 'app/features/expressions/images/dark/reduce.svg';
import resampleDarkImage from 'app/features/expressions/images/dark/resample.svg';
import sqlDarkImage from 'app/features/expressions/images/dark/sqlExpression.svg';
import thresholdDarkImage from 'app/features/expressions/images/dark/threshold.svg';
import classicConditionLightImage from 'app/features/expressions/images/light/classicCondition.svg';
import mathLightImage from 'app/features/expressions/images/light/math.svg';
import reduceLightImage from 'app/features/expressions/images/light/reduce.svg';
import resampleLightImage from 'app/features/expressions/images/light/resample.svg';
import sqlLightImage from 'app/features/expressions/images/light/sqlExpression.svg';
import thresholdLightImage from 'app/features/expressions/images/light/threshold.svg';
import { ExpressionQueryType } from 'app/features/expressions/types';

import { QueryOptionField } from './QueryEditor/types';

export enum QueryEditorType {
  Query = 'query',
  Expression = 'expression',
  Transformation = 'transformation',
  Alert = 'alert',
}
export enum SidebarSize {
  Mini = 'mini',
  Full = 'full',
}

export const QUERY_EDITOR_SIDEBAR_SIZE_KEY = 'grafana.dashboard.query-editor-next.sidebar-size';

export const QUERY_EDITOR_COLORS = {
  footerBackground: '#1e2939',
  sidebarFooterBackground: '#141820',
  query: '#FF8904',
  expression: '#C27AFF',
  transformation: '#00D492',
  card: {
    activeBg: '#314158',
    hoverBg: '#1D293D',
    headerBg: '#20262F',
  },
};

export interface QueryEditorTypeConfig {
  icon: IconName;
  color: string;
  getLabel: () => string;
  deleteConfirmation: boolean;
}

/**
 * Gets the color for an alert based on its state from the theme.
 * Used for alert card borders and indicators.
 */
export function getAlertStateColor(theme: GrafanaTheme2, state: AlertState | null): string {
  if (!state) {
    return theme.colors.text.secondary;
  }

  switch (state) {
    case AlertState.Alerting:
      return theme.colors.error.main;
    case AlertState.Pending:
      return theme.colors.warning.main;
    case AlertState.NoData:
      return theme.colors.info.main;
    case AlertState.Paused:
      return theme.colors.text.disabled;
    case AlertState.OK:
    default:
      return theme.colors.success.main;
  }
}

export const QUERY_EDITOR_TYPE_CONFIG: Record<QueryEditorType, QueryEditorTypeConfig> = {
  [QueryEditorType.Query]: {
    icon: 'database',
    color: QUERY_EDITOR_COLORS.query,
    getLabel: () => t('query-editor-next.labels.query', 'Query'),
    deleteConfirmation: false,
  },
  [QueryEditorType.Expression]: {
    icon: 'calculator-alt',
    color: QUERY_EDITOR_COLORS.expression,
    getLabel: () => t('query-editor-next.labels.expression', 'Expression'),
    deleteConfirmation: false,
  },
  [QueryEditorType.Transformation]: {
    icon: 'process',
    color: QUERY_EDITOR_COLORS.transformation,
    getLabel: () => t('query-editor-next.labels.transformation', 'Transformation'),
    deleteConfirmation: true,
  },
  [QueryEditorType.Alert]: {
    icon: 'bell',
    // Note: For alerts, use getAlertStateColor() instead of this static color
    // This placeholder is only used when alert state is unknown
    color: '#6E6E6E',
    getLabel: () => t('query-editor-next.labels.alert', 'Alert'),
    deleteConfirmation: false,
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

export const EXPRESSION_IMAGE_MAP: Record<ExpressionQueryType, { dark: string; light: string }> = {
  [ExpressionQueryType.sql]: { dark: sqlDarkImage, light: sqlLightImage },
  [ExpressionQueryType.math]: { dark: mathDarkImage, light: mathLightImage },
  [ExpressionQueryType.reduce]: { dark: reduceDarkImage, light: reduceLightImage },
  [ExpressionQueryType.resample]: { dark: resampleDarkImage, light: resampleLightImage },
  [ExpressionQueryType.classic]: { dark: classicConditionDarkImage, light: classicConditionLightImage },
  [ExpressionQueryType.threshold]: { dark: thresholdDarkImage, light: thresholdLightImage },
};
