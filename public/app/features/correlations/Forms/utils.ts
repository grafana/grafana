import { type TimeOption } from '@grafana/data';
import { t } from '@grafana/i18n';

import { type Correlation } from '../types';

type CorrelationBaseData = Pick<Correlation, 'uid' | 'sourceUID'>;

export const getInputId = (inputName: string, correlation?: CorrelationBaseData) => {
  if (!correlation) {
    return inputName;
  }

  return `${inputName}_${correlation.sourceUID}-${correlation.uid}`;
};

export const getQuickOptionsForCorrelation: () => TimeOption[] = () => [
  { from: 'field-5m', to: 'field+5m', display: t('correlations.timerange.5-mins', '± 5 minutes') },
  {
    from: 'field-15m',
    to: 'field+15m',
    display: t('correlations.timerange.15-mins', '± 15 minutes'),
  },
  {
    from: 'field-30m',
    to: 'field+30m',
    display: t('correlations.timerange.30-mins', '± 30 minutes'),
  },
  { from: 'field-1h', to: 'field+1h', display: t('correlations.timerange.1-hour', '± 1 hour') },
  { from: 'field-3h', to: 'field+3h', display: t('correlations.timerange.3-hours', '± 3 hours') },
  { from: 'field-6h', to: 'field+6h', display: t('correlations.timerange.6-hours', '± 6 hours') },
  {
    from: 'field-12h',
    to: 'field+12h',
    display: t('correlations.timerange.12-hours', '± 12 hours'),
  },
  {
    from: 'field-24h',
    to: 'field+24h',
    display: t('correlations.timerange.24-hours', '± 24 hours'),
  },
  { from: 'field-2d', to: 'field+2d', display: t('correlations.timerange.2-days', '± 2 days') },
  { from: 'field-7d', to: 'field+7d', display: t('correlations.timerange.7-days', '± 7 days') },
  { from: 'field-30d', to: 'field+30d', display: t('correlations.timerange.30-days', '± 30 days') },
  { from: 'field-90d', to: 'field+90d', display: t('correlations.timerange.90-days', '± 90 days') },
  {
    from: 'field-6m',
    to: 'field+6m',
    display: t('correlations.timerange.6-months', '± 6 months'),
  },
  { from: 'field-1y', to: 'field+1y', display: t('correlations.timerange.1-year', '± 1 year') },
];
