import { SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';

// Enterprise only sort field values for dashboards
const sortFields = [
  { name: 'views_total', display: 'Views total' },
  { name: 'views_last_30_days', display: 'Views 30 days' },
  { name: 'errors_total', display: 'Errors total' },
  { name: 'errors_last_30_days', display: 'Errors 30 days' },
];

// This should eventually be filled by an API call, but hardcoded is a good start
export async function getSortOptions(): Promise<SelectableValue[]> {
  const opts: SelectableValue[] = [
    { value: 'name_sort', label: 'Alphabetically (A-Z)' },
    { value: '-name_sort', label: 'Alphabetically (Z-A)' },
  ];

  if (config.licenseInfo.enabledFeatures.analytics) {
    for (const sf of sortFields) {
      opts.push({ value: `-${sf.name}`, label: `${sf.display} (most)` });
      opts.push({ value: `${sf.name}`, label: `${sf.display} (least)` });
    }
  }

  return opts;
}

/** Given the internal field name, this gives a reasonable display name for the table colum header */
export function getSortFieldDisplayName(name: string) {
  for (const sf of sortFields) {
    if (sf.name === name) {
      return sf.display;
    }
  }
  return name;
}
