import React, { SFC } from 'react';
import _ from 'lodash';

import { MetricSelect } from 'app/core/components/Select/MetricSelect';
import { alignmentPeriods } from '../constants';

export interface Props {
  onChange: (alignmentPeriod) => void;
  templateSrv: any;
  alignmentPeriod: string;
}

export const AlignmentPeriods: SFC<Props> = ({ alignmentPeriod, templateSrv, onChange }) => {
  return (
    <React.Fragment>
      <div className="gf-form-inline">
        <div className="gf-form">
          <label className="gf-form-label query-keyword width-9">Alignment Period</label>
          <MetricSelect
            onChange={value => onChange(value)}
            value={alignmentPeriod}
            variables={templateSrv.variables}
            options={[
              {
                label: 'Alignment options',
                expanded: true,
                options: alignmentPeriods.map(ap => ({
                  ...ap,
                  label: ap.text,
                })),
              },
            ]}
            placeholder="Select Alignment"
            className="width-15"
          />
        </div>
      </div>
    </React.Fragment>
  );
};
