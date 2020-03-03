import React, { FC } from 'react';
import _ from 'lodash';

import { TemplateSrv } from 'app/features/templating/template_srv';
import kbn from 'app/core/utils/kbn';
import { SelectableValue } from '@grafana/data';
import { Segment } from '@grafana/ui';
import { alignmentPeriods, alignOptions } from '../constants';

export interface Props {
  onChange: (alignmentPeriod: string) => void;
  templateSrv: TemplateSrv;
  templateVariableOptions: Array<SelectableValue<string>>;
  alignmentPeriod: string;
  perSeriesAligner: string;
  usedAlignmentPeriod: string;
}

export const AlignmentPeriods: FC<Props> = ({
  alignmentPeriod,
  templateSrv,
  templateVariableOptions,
  onChange,
  perSeriesAligner,
  usedAlignmentPeriod,
}) => {
  const alignment = alignOptions.find(ap => ap.value === templateSrv.replace(perSeriesAligner));
  const formatAlignmentText = `${kbn.secondsToHms(usedAlignmentPeriod)} interval (${alignment ? alignment.text : ''})`;
  const options = alignmentPeriods.map(ap => ({
    ...ap,
    label: ap.text,
  }));

  return (
    <>
      <div className="gf-form-inline">
        <label className="gf-form-label query-keyword width-9">Alignment Period</label>
        <Segment
          onChange={({ value }) => onChange(value)}
          value={[...options, ...templateVariableOptions].find(s => s.value === alignmentPeriod)}
          options={[
            {
              label: 'Template Variables',
              options: templateVariableOptions,
            },
            {
              label: 'Aggregations',
              expanded: true,
              options: options,
            },
          ]}
          placeholder="Select Alignment"
        ></Segment>
        <div className="gf-form gf-form--grow">
          {usedAlignmentPeriod && <label className="gf-form-label gf-form-label--grow">{formatAlignmentText}</label>}
        </div>
      </div>
    </>
  );
};
