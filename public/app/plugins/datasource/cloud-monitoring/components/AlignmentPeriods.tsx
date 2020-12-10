import React, { FC } from 'react';
import _ from 'lodash';

import { TemplateSrv } from '@grafana/runtime';
import { SelectableValue, rangeUtil } from '@grafana/data';
import { Segment } from '@grafana/ui';
import { alignmentPeriods, alignOptions } from '../constants';

export interface Props {
  onChange: (alignmentPeriod: string) => void;
  templateSrv: TemplateSrv;
  templateVariableOptions: Array<SelectableValue<string>>;
  alignmentPeriod: string;
  perSeriesAligner: string;
  usedAlignmentPeriod?: number;
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
  const formatAlignmentText = usedAlignmentPeriod
    ? `${rangeUtil.secondsToHms(usedAlignmentPeriod)} interval (${alignment ? alignment.text : ''})`
    : '';
  const options = alignmentPeriods.map(ap => ({
    ...ap,
    label: ap.text,
  }));
  const visibleOptions = options.filter(ap => !ap.hidden);

  return (
    <>
      <div className="gf-form-inline">
        <label className="gf-form-label query-keyword width-9">Alignment Period</label>
        <Segment
          onChange={({ value }) => onChange(value!)}
          value={[...options, ...templateVariableOptions].find(s => s.value === alignmentPeriod)}
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
        ></Segment>
        <div className="gf-form gf-form--grow">
          {usedAlignmentPeriod && <label className="gf-form-label gf-form-label--grow">{formatAlignmentText}</label>}
        </div>
      </div>
    </>
  );
};
