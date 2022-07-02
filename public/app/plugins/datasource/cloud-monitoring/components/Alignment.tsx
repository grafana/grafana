import React, { FC } from 'react';

import { SelectableValue } from '@grafana/data';

import { ALIGNMENT_PERIODS, SELECT_WIDTH } from '../constants';
import CloudMonitoringDatasource from '../datasource';
import { CustomMetaData, MetricQuery, SLOQuery } from '../types';

import { AlignmentFunction, PeriodSelect, AlignmentPeriodLabel, QueryEditorField, QueryEditorRow } from '.';

export interface Props {
  refId: string;
  onChange: (query: MetricQuery | SLOQuery) => void;
  query: MetricQuery;
  templateVariableOptions: Array<SelectableValue<string>>;
  customMetaData: CustomMetaData;
  datasource: CloudMonitoringDatasource;
}

export const Alignment: FC<Props> = ({
  refId,
  templateVariableOptions,
  onChange,
  query,
  customMetaData,
  datasource,
}) => {
  return (
    <QueryEditorRow
      label="Alignment function"
      tooltip="The process of alignment consists of collecting all data points received in a fixed length of time, applying a function to combine those data points, and assigning a timestamp to the result."
      fillComponent={<AlignmentPeriodLabel datasource={datasource} customMetaData={customMetaData} />}
      htmlFor={`${refId}-alignment-function`}
    >
      <AlignmentFunction
        inputId={`${refId}-alignment-function`}
        templateVariableOptions={templateVariableOptions}
        query={query}
        onChange={onChange}
      />
      <QueryEditorField label="Alignment period" htmlFor={`${refId}-alignment-period`}>
        <PeriodSelect
          inputId={`${refId}-alignment-period`}
          selectWidth={SELECT_WIDTH}
          templateVariableOptions={templateVariableOptions}
          current={query.alignmentPeriod}
          onChange={(period) => onChange({ ...query, alignmentPeriod: period })}
          aligmentPeriods={ALIGNMENT_PERIODS}
        />
      </QueryEditorField>
    </QueryEditorRow>
  );
};
