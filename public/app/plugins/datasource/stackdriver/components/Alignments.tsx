import React, { FC } from 'react';

import { SelectableValue } from '@grafana/data';
import { Segment } from '@grafana/ui';

export interface Props {
  onChange: (perSeriesAligner: string) => void;
  templateVariableOptions: Array<SelectableValue<string>>;
  alignOptions: Array<SelectableValue<string>>;
  perSeriesAligner: string;
}

export const Alignments: FC<Props> = ({ perSeriesAligner, templateVariableOptions, onChange, alignOptions }) => {
  return (
    <>
      <div className="gf-form-inline">
        <div className="gf-form offset-width-9">
          <label className="gf-form-label query-keyword width-15">Aligner</label>
          <Segment
            onChange={({ value }) => onChange(value!)}
            value={[...alignOptions, ...templateVariableOptions].find(s => s.value === perSeriesAligner)}
            options={[
              {
                label: 'Template Variables',
                options: templateVariableOptions,
              },
              {
                label: 'Alignment options',
                expanded: true,
                options: alignOptions,
              },
            ]}
            placeholder="Select Alignment"
          ></Segment>
        </div>
      </div>
    </>
  );
};
