import React, { SFC } from 'react';
import _ from 'lodash';

import { MetricSelect } from 'app/core/components/Select/MetricSelect';

export interface Props {
  onChange: (perSeriesAligner) => void;
  templateSrv: any;
  alignOptions: any[];
  perSeriesAligner: string;
}

export const Alignments: SFC<Props> = ({ perSeriesAligner, templateSrv, onChange, alignOptions }) => {
  return (
    <React.Fragment>
      <div className="gf-form-group">
        <div className="gf-form offset-width-9">
          <label className="gf-form-label query-keyword width-15">Aligner</label>
          <MetricSelect
            onChange={value => onChange(value)}
            value={perSeriesAligner}
            variables={templateSrv.variables}
            options={alignOptions}
            placeholder="Select Alignment"
            className="width-15"
          />
        </div>
      </div>
    </React.Fragment>
  );
};
