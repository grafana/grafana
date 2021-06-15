import React, { FunctionComponent } from 'react';
import { SelectableValue } from '@grafana/data';
import { Segment } from '@grafana/ui';
import { QueryType } from '../types';
import { QUERY_TYPES } from '../constants';

export interface Props {
  value: QueryType;
  onChange: (slo: QueryType) => void;
  templateVariableOptions: Array<SelectableValue<string>>;
}

export const QueryTypeSelector: FunctionComponent<Props> = ({ onChange, value, templateVariableOptions }) => {
  return (
    <div className="gf-form-inline">
      <label className="gf-form-label query-keyword width-9">Query Type</label>
      <Segment
        value={[...QUERY_TYPES, ...templateVariableOptions].find((qt) => qt.value === value)}
        options={[
          ...QUERY_TYPES,
          {
            label: 'Template Variables',
            options: templateVariableOptions,
          },
        ]}
        onChange={({ value }: SelectableValue<QueryType>) => onChange(value!)}
      />

      <div className="gf-form gf-form--grow">
        <label className="gf-form-label gf-form-label--grow"></label>
      </div>
    </div>
  );
};
