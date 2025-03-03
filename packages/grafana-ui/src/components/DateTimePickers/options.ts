import type { TimeOption } from '@grafana/data';

import { ComboboxOption } from '../Combobox/types';

import { getQuickRanges } from './utils';

// Get quick options from the backend settings or fall back to defaults
// Ensure we always have an array, even if getQuickRanges fails for some reason
export const quickOptions: TimeOption[] = (() => {
  try {
    const ranges = getQuickRanges();
    return Array.isArray(ranges) && ranges.length > 0 ? ranges : [];
  } catch (e) {
    console.error('Error loading quick ranges:', e);
    return [];
  }
})();

export const monthOptions: Array<ComboboxOption<number>> = [
  { label: 'January', value: 0 },
  { label: 'February', value: 1 },
  { label: 'March', value: 2 },
  { label: 'April', value: 3 },
  { label: 'May', value: 4 },
  { label: 'June', value: 5 },
  { label: 'July', value: 6 },
  { label: 'August', value: 7 },
  { label: 'September', value: 8 },
  { label: 'October', value: 9 },
  { label: 'November', value: 10 },
  { label: 'December', value: 11 },
];
