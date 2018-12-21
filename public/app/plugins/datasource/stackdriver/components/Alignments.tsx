import React, { SFC } from 'react';
import _ from 'lodash';

import { StackdriverPicker } from './StackdriverPicker';

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
          <StackdriverPicker
            onChange={value => onChange(value)}
            selected={perSeriesAligner}
            templateVariables={templateSrv.variables}
            options={alignOptions}
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
