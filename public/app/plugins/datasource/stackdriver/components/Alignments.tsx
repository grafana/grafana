import React, { FC } from 'react';

import { Segment } from '@grafana/ui';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { SelectableValue } from '@grafana/data';

export interface Props {
  onChange: (perSeriesAligner: any) => void;
  templateSrv: TemplateSrv;
  alignOptions: Array<SelectableValue<string>>;
  perSeriesAligner: string;
}

export const Alignments: FC<Props> = ({ perSeriesAligner, templateSrv, onChange, alignOptions }) => {
  const templateVariableOptions = templateSrv.variables.map(v => ({
    label: `$${v.name}`,
    value: `$${v.name}`,
  }));
  return (
    <>
      <div className="gf-form-group">
        <div className="gf-form offset-width-9">
          <label className="gf-form-label query-keyword width-15">Aligner</label>
          <Segment
            onChange={({ value }) => onChange(value)}
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
