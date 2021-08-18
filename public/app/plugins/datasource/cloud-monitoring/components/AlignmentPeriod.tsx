import React, { FC, useMemo } from 'react';
import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';
import { ALIGNMENT_PERIODS } from '../constants';
import { BaseQuery } from '../types';

export interface Props {
  onChange: (query: BaseQuery) => void;
  query: BaseQuery;
  templateVariableOptions: Array<SelectableValue<string>>;
  selectWidth?: number;
}

export const AlignmentPeriod: FC<Props> = ({ templateVariableOptions, onChange, query, selectWidth }) => {
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
    ></Select>
  );
};
