import React, { FC } from 'react';
import _ from 'lodash';
import { SelectableValue } from '@grafana/data';
import { InlineField } from '@grafana/ui';
import { LABEL_WIDTH } from '../constants';
import { CustomMetaData, MetricQuery } from '../types';
import { AlignmentFunction, AlignmentPeriod, AlignmentPeriodLabel, InlineFields } from '.';
import CloudMonitoringDatasource from '../datasource';

export interface Props {
  onChange: (query: MetricQuery) => void;
  query: MetricQuery;
  templateVariableOptions: Array<SelectableValue<string>>;
  customMetaData: CustomMetaData;
  datasource: CloudMonitoringDatasource;
}

export const Alignment: FC<Props> = ({ templateVariableOptions, onChange, query, customMetaData, datasource }) => {
  return (
    <InlineFields
      label="Alignment"
      transparent
      labelWidth={LABEL_WIDTH}
      tooltip="The process of alignment consists of collecting all data points received in a fixed length of time, applying a function to combine those data points, and assigning a timestamp to the result."
    >
      <AlignmentFunction templateVariableOptions={templateVariableOptions} query={query} onChange={onChange} />
      <InlineField label="Period" className="">
        <AlignmentPeriod templateVariableOptions={templateVariableOptions} query={query} onChange={onChange} />
      </InlineField>
      <AlignmentPeriodLabel datasource={datasource} customMetaData={customMetaData} />
    </InlineFields>
  );
};
