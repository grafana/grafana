import { t } from '@grafana/i18n';

export const getCompareOptions = () => [
  { label: t('common.disabled', 'Disabled'), value: '' },
  { label: t('dashboard.panel.time-range-settings.compare-day-before', 'Day before'), value: '1d' },
  { label: t('dashboard.panel.time-range-settings.compare-week-before', 'Week before'), value: '1w' },
  { label: t('dashboard.panel.time-range-settings.compare-month-before', 'Month before'), value: '1M' },
];

/**
 * Text for the panel header's time-override indicator, e.g. "compared to day before".
 * Returns an empty string for custom offsets that have no matching preset label.
 */
export function getCompareTimeInfoText(compareWith: string): string {
  const option = getCompareOptions().find((x) => x.value === compareWith);

  if (!option) {
    return '';
  }

  return t('dashboard.panel.time-range-settings.compared-to', 'compared to {{option}}', {
    option: option.label.toLowerCase(),
  });
}
