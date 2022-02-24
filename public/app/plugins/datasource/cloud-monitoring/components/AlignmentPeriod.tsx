import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';
import React, { useMemo } from 'react';

import { ALIGNMENT_PERIODS } from '../constants';
import { MetricQuery, SLOQuery } from '../types';

export interface Props<TQuery> {
  inputId: string;
  onChange(query: TQuery): void;
  query: TQuery;
  templateVariableOptions: Array<SelectableValue<string>>;
  selectWidth?: number;
}

export function AlignmentPeriod<TQuery extends MetricQuery | SLOQuery>({
  inputId,
  templateVariableOptions,
  onChange,
  query,
  selectWidth,
}: Props<TQuery>) {
  const options = useMemo(
    () =>
      ALIGNMENT_PERIODS.map((ap) => ({
        ...ap,
        label: ap.text,
      })),
    []
  );
  const visibleOptions = useMemo(() => options.filter((ap) => !ap.hidden), [options]);

  return (
    <Select
      menuShouldPortal
      width={selectWidth}
      onChange={({ value }) => onChange({ ...query, alignmentPeriod: value! })}
      value={[...options, ...templateVariableOptions].find((s) => s.value === query.alignmentPeriod)}
      options={[
        {
          label: 'Template Variables',
          options: templateVariableOptions,
        },
        {
          label: 'Aggregations',
          expanded: true,
          options: visibleOptions,
        },
      ]}
      placeholder="Select Alignment"
      inputId={inputId}
    ></Select>
  );
}
