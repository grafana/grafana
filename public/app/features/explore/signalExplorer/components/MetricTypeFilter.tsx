import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import { Combobox, type ComboboxOption } from '@grafana/ui';

import { getMetricTypeOptions } from '../data/metricType';
import type { MetricType } from '../types';

export interface MetricTypeFilterProps {
  value: MetricType | null;
  onChange: (value: MetricType | null) => void;
}

export function MetricTypeFilter({ value, onChange }: MetricTypeFilterProps) {
  const options = useMemo(() => getMetricTypeOptions(), []);
  const label = t('explore.signal-explorer.filter-by-type', 'Filter by type');

  return (
    <Combobox<MetricType>
      isClearable
      aria-label={label}
      placeholder={label}
      options={options}
      value={value}
      onChange={(option: ComboboxOption<MetricType> | null) => onChange(option?.value ?? null)}
    />
  );
}
