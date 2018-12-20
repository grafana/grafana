import React, { SFC } from 'react';
import _ from 'lodash';

import { StackdriverPicker } from './StackdriverPicker';
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
          <StackdriverPicker
            onChange={value => onChange(value)}
            selected={alignmentPeriod}
            templateVariables={templateSrv.variables}
            options={alignmentPeriods.map(ap => ({
              ...ap,
              label: ap.text,
            }))}
            searchable={true}
            placeholder="Select Alignment"
            className="width-15"
            groupName="Alignment Options"
          />
        </div>
      </div>
    </React.Fragment>
  );
};
