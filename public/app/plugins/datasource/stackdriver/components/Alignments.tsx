import React, { FC } from 'react';
import _ from 'lodash';

import { MetricSelect } from 'app/core/components/Select/MetricSelect';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { SelectOptionItem } from '@grafana/ui';

export interface Props {
  onChange: (perSeriesAligner) => void;
  templateSrv: TemplateSrv;
  alignOptions: Array<SelectOptionItem<string>>;
  perSeriesAligner: string;
}

export const Alignments: FC<Props> = ({ perSeriesAligner, templateSrv, onChange, alignOptions }) => {
  return (
    <>
      <div className="gf-form-group">
        <div className="gf-form offset-width-9">
          <label className="gf-form-label query-keyword width-15">Aligner</label>
          <MetricSelect
            onChange={onChange}
            value={perSeriesAligner}
            variables={templateSrv.variables}
            options={alignOptions}
            placeholder="Select Alignment"
            className="width-15"
          />
        </div>
      </div>
    </>
  );
};
