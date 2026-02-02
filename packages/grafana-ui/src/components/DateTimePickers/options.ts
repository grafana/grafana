import { TimeOption } from '@grafana/data';

import { ComboboxOption } from '../Combobox/types';

import { t } from '../../utils/i18n';

// BMC Change: Wrapping the options in a function
// so that i18n bootstarps and label localized accordingly
export const getQuickOptions = (): TimeOption[] => {
  return [
    {
      from: 'now-5m',
      to: 'now',
      display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.last-5-min', 'Last 5 minutes'),
    },
    {
      from: 'now-15m',
      to: 'now',
      display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.last-15-min', 'Last 15 minutes'),
    },
    {
      from: 'now-30m',
      to: 'now',
      display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.last-30-min', 'Last 30 minutes'),
    },
    {
      from: 'now-1h',
      to: 'now',
      display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.last-1-hour', 'Last 1 hour'),
    },
    {
      from: 'now-3h',
      to: 'now',
      display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.last-3-hour', 'Last 3 hours'),
    },
    {
      from: 'now-6h',
      to: 'now',
      display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.last-6-hour', 'Last 6 hours'),
    },
    {
      from: 'now-12h',
      to: 'now',
      display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.last-12-hour', 'Last 12 hours'),
    },
    {
      from: 'now-24h',
      to: 'now',
      display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.last-24-hour', 'Last 24 hours'),
    },
    { from: 'now-2d', to: 'now', display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.last-2-day', 'Last 2 days') },
    { from: 'now-7d', to: 'now', display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.last-7-day', 'Last 7 days') },
    {
      from: 'now-30d',
      to: 'now',
      display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.last-30-day', 'Last 30 days'),
    },
    {
      from: 'now-90d',
      to: 'now',
      display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.last-90-day', 'Last 90 days'),
    },
    {
      from: 'now-6M',
      to: 'now',
      display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.last-6-month', 'Last 6 months'),
    },
    {
      from: 'now-1y',
      to: 'now',
      display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.last-1-year', 'Last 1 year'),
    },
    {
      from: 'now-2y',
      to: 'now',
      display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.last-2-year', 'Last 2 years'),
    },
    {
      from: 'now-5y',
      to: 'now',
      display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.last-5-year', 'Last 5 years'),
    },
    {
      from: 'now-1d/d',
      to: 'now-1d/d',
      display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.yesterday', 'Yesterday'),
    },
    {
      from: 'now-2d/d',
      to: 'now-2d/d',
      display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.day-before-yesterday', 'Day before yesterday'),
    },
    {
      from: 'now-7d/d',
      to: 'now-7d/d',
      display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.this-day-last-week', 'This day last week'),
    },
    {
      from: 'now-1w/w',
      to: 'now-1w/w',
      display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.prev-week', 'Previous week'),
    },
    {
      from: 'now-1M/M',
      to: 'now-1M/M',
      display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.prev-month', 'Previous month'),
    },
    {
      from: 'now-1Q/fQ',
      to: 'now-1Q/fQ',
      display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.prev-fiscal-quarter', 'Previous fiscal quarter'),
    },
    {
      from: 'now-1y/y',
      to: 'now-1y/y',
      display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.prev-year', 'Previous year'),
    },
    {
      from: 'now-1y/fy',
      to: 'now-1y/fy',
      display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.prev-fiscal-year', 'Previous fiscal year'),
    },
    { from: 'now/d', to: 'now/d', display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.today', 'Today') },
    {
      from: 'now/d',
      to: 'now',
      display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.today-so-far', 'Today so far'),
    },
    { from: 'now/w', to: 'now/w', display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.this-week', 'This week') },
    {
      from: 'now/w',
      to: 'now',
      display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.this-week-so-far', 'This week so far'),
    },
    { from: 'now/M', to: 'now/M', display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.this-month', 'This month') },
    {
      from: 'now/M',
      to: 'now',
      display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.this-month-so-far', 'This month so far'),
    },
    { from: 'now/y', to: 'now/y', display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.this-year', 'This year') },
    {
      from: 'now/y',
      to: 'now',
      display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.this-year-so-far', 'This year so far'),
    },
    {
      from: 'now/fQ',
      to: 'now',
      display: t(
        'bmcgrafana.grafana-ui.date-time.quick-ranges.this-fiscal-quarter-so-far',
        'This fiscal quarter so far'
      ),
    },
    {
      from: 'now/fQ',
      to: 'now/fQ',
      display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.this-fiscal-quarter', 'This fiscal quarter'),
    },
    {
      from: 'now/fy',
      to: 'now',
      display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.this-fiscal-year-so-far', 'This fiscal year so far'),
    },
    {
      from: 'now/fy',
      to: 'now/fy',
      display: t('bmcgrafana.grafana-ui.date-time.quick-ranges.this-fiscal-year', 'This fiscal year'),
    },
  ];
};

export const getMonthOptions = (): Array<ComboboxOption<number>> => [
  { label: t('bmcgrafana.grafana-ui.date-time.month.jan', 'January'), value: 0 },
  { label: t('bmcgrafana.grafana-ui.date-time.month.feb', 'February'), value: 1 },
  { label: t('bmcgrafana.grafana-ui.date-time.month.mar', 'March'), value: 2 },
  { label: t('bmcgrafana.grafana-ui.date-time.month.apr', 'April'), value: 3 },
  { label: t('bmcgrafana.grafana-ui.date-time.month.may', 'May'), value: 4 },
  { label: t('bmcgrafana.grafana-ui.date-time.month.jun', 'June'), value: 5 },
  { label: t('bmcgrafana.grafana-ui.date-time.month.jul', 'July'), value: 6 },
  { label: t('bmcgrafana.grafana-ui.date-time.month.aug', 'August'), value: 7 },
  { label: t('bmcgrafana.grafana-ui.date-time.month.sep', 'September'), value: 8 },
  { label: t('bmcgrafana.grafana-ui.date-time.month.oct', 'October'), value: 9 },
  { label: t('bmcgrafana.grafana-ui.date-time.month.nov', 'November'), value: 10 },
  { label: t('bmcgrafana.grafana-ui.date-time.month.dec', 'December'), value: 11 },
];
