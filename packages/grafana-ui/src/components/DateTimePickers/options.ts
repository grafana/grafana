import { TimeOption } from '@grafana/data';
import { t } from '@grafana/i18n';

import { ComboboxOption } from '../Combobox/types';

export const getQuickOptions: () => TimeOption[] = () => [
  { from: 'now-5m', to: 'now', display: t('grafana-ui.date-time-pickers.quick-options.last-5-mins', 'Last 5 minutes') },
  {
    from: 'now-15m',
    to: 'now',
    display: t('grafana-ui.date-time-pickers.quick-options.last-15-mins', 'Last 15 minutes'),
  },
  {
    from: 'now-30m',
    to: 'now',
    display: t('grafana-ui.date-time-pickers.quick-options.last-30-mins', 'Last 30 minutes'),
  },
  { from: 'now-1h', to: 'now', display: t('grafana-ui.date-time-pickers.quick-options.last-1-hour', 'Last 1 hour') },
  { from: 'now-3h', to: 'now', display: t('grafana-ui.date-time-pickers.quick-options.last-3-hours', 'Last 3 hours') },
  { from: 'now-6h', to: 'now', display: t('grafana-ui.date-time-pickers.quick-options.last-6-hours', 'Last 6 hours') },
  {
    from: 'now-12h',
    to: 'now',
    display: t('grafana-ui.date-time-pickers.quick-options.last-12-hours', 'Last 12 hours'),
  },
  {
    from: 'now-24h',
    to: 'now',
    display: t('grafana-ui.date-time-pickers.quick-options.last-24-hours', 'Last 24 hours'),
  },
  { from: 'now-2d', to: 'now', display: t('grafana-ui.date-time-pickers.quick-options.last-2-days', 'Last 2 days') },
  { from: 'now-7d', to: 'now', display: t('grafana-ui.date-time-pickers.quick-options.last-7-days', 'Last 7 days') },
  { from: 'now-30d', to: 'now', display: t('grafana-ui.date-time-pickers.quick-options.last-30-days', 'Last 30 days') },
  { from: 'now-90d', to: 'now', display: t('grafana-ui.date-time-pickers.quick-options.last-90-days', 'Last 90 days') },
  {
    from: 'now-6M',
    to: 'now',
    display: t('grafana-ui.date-time-pickers.quick-options.last-6-months', 'Last 6 months'),
  },
  { from: 'now-1y', to: 'now', display: t('grafana-ui.date-time-pickers.quick-options.last-1-year', 'Last 1 year') },
  { from: 'now-2y', to: 'now', display: t('grafana-ui.date-time-pickers.quick-options.last-2-years', 'Last 2 years') },
  { from: 'now-5y', to: 'now', display: t('grafana-ui.date-time-pickers.quick-options.last-5-years', 'Last 5 years') },
  { from: 'now-1d/d', to: 'now-1d/d', display: t('grafana-ui.date-time-pickers.quick-options.yesterday', 'Yesterday') },
  {
    from: 'now-2d/d',
    to: 'now-2d/d',
    display: t('grafana-ui.date-time-pickers.quick-options.day-before-yesterday', 'Day before yesterday'),
  },
  {
    from: 'now-7d/d',
    to: 'now-7d/d',
    display: t('grafana-ui.date-time-pickers.quick-options.this-day-last-week', 'This day last week'),
  },
  {
    from: 'now-1w/w',
    to: 'now-1w/w',
    display: t('grafana-ui.date-time-pickers.quick-options.previous-week', 'Previous week'),
  },
  {
    from: 'now-1M/M',
    to: 'now-1M/M',
    display: t('grafana-ui.date-time-pickers.quick-options.previous-month', 'Previous month'),
  },
  {
    from: 'now-1Q/fQ',
    to: 'now-1Q/fQ',
    display: t('grafana-ui.date-time-pickers.quick-options.previous-fiscal-quarter', 'Previous fiscal quarter'),
  },
  {
    from: 'now-1y/y',
    to: 'now-1y/y',
    display: t('grafana-ui.date-time-pickers.quick-options.previous-year', 'Previous year'),
  },
  {
    from: 'now-1y/fy',
    to: 'now-1y/fy',
    display: t('grafana-ui.date-time-pickers.quick-options.previous-fiscal-year', 'Previous fiscal year'),
  },
  { from: 'now/d', to: 'now/d', display: t('grafana-ui.date-time-pickers.quick-options.today', 'Today') },
  { from: 'now/d', to: 'now', display: t('grafana-ui.date-time-pickers.quick-options.today-so-far', 'Today so far') },
  { from: 'now/w', to: 'now/w', display: t('grafana-ui.date-time-pickers.quick-options.this-week', 'This week') },
  {
    from: 'now/w',
    to: 'now',
    display: t('grafana-ui.date-time-pickers.quick-options.this-week-so-far', 'This week so far'),
  },
  { from: 'now/M', to: 'now/M', display: t('grafana-ui.date-time-pickers.quick-options.this-month', 'This month') },
  {
    from: 'now/M',
    to: 'now',
    display: t('grafana-ui.date-time-pickers.quick-options.this-month-so-far', 'This month so far'),
  },
  { from: 'now/y', to: 'now/y', display: t('grafana-ui.date-time-pickers.quick-options.this-year', 'This year') },
  {
    from: 'now/y',
    to: 'now',
    display: t('grafana-ui.date-time-pickers.quick-options.this-year-so-far', 'This year so far'),
  },
  {
    from: 'now/fQ',
    to: 'now',
    display: t('grafana-ui.date-time-pickers.quick-options.this-fiscal-quarter-so-far', 'This fiscal quarter so far'),
  },
  {
    from: 'now/fQ',
    to: 'now/fQ',
    display: t('grafana-ui.date-time-pickers.quick-options.this-fiscal-quarter', 'This fiscal quarter'),
  },
  {
    from: 'now/fy',
    to: 'now',
    display: t('grafana-ui.date-time-pickers.quick-options.this-fiscal-year-so-far', 'This fiscal year so far'),
  },
  {
    from: 'now/fy',
    to: 'now/fy',
    display: t('grafana-ui.date-time-pickers.quick-options.this-fiscal-year', 'This fiscal year'),
  },
];

export const getMonthOptions: () => Array<ComboboxOption<number>> = () => [
  { label: t('grafana-ui.date-time-pickers.month-options.label-january', 'January'), value: 0 },
  { label: t('grafana-ui.date-time-pickers.month-options.label-february', 'February'), value: 1 },
  { label: t('grafana-ui.date-time-pickers.month-options.label-march', 'March'), value: 2 },
  { label: t('grafana-ui.date-time-pickers.month-options.label-april', 'April'), value: 3 },
  { label: t('grafana-ui.date-time-pickers.month-options.label-may', 'May'), value: 4 },
  { label: t('grafana-ui.date-time-pickers.month-options.label-june', 'June'), value: 5 },
  { label: t('grafana-ui.date-time-pickers.month-options.label-july', 'July'), value: 6 },
  { label: t('grafana-ui.date-time-pickers.month-options.label-august', 'August'), value: 7 },
  { label: t('grafana-ui.date-time-pickers.month-options.label-september', 'September'), value: 8 },
  { label: t('grafana-ui.date-time-pickers.month-options.label-october', 'October'), value: 9 },
  { label: t('grafana-ui.date-time-pickers.month-options.label-november', 'November'), value: 10 },
  { label: t('grafana-ui.date-time-pickers.month-options.label-december', 'December'), value: 11 },
];
