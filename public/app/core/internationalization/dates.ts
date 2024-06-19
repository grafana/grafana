import '@formatjs/intl-durationformat/polyfill';

import { getI18next } from './index';

export function formatDate(value: number | Date | string, format: Intl.DateTimeFormatOptions = {}): string {
  if (typeof value === 'string') {
    return formatDate(new Date(value), format);
  }

  const i18n = getI18next();
  const dateFormatter = new Intl.DateTimeFormat(i18n.language, format);
  return dateFormatter.format(value);
}

export function formatDuration(duration: Intl.DurationInput, options: Intl.DurationFormatOptions = {}) {
  const i18n = getI18next();

  const dateFormatter = new Intl.DurationFormat(i18n.language, options);
  return dateFormatter.format(duration);
}
