import { SelectableValue } from '@grafana/data';
import React, { FC } from 'react';

import { AlignmentFunction, AlignmentPeriod, AlignmentPeriodLabel, QueryEditorField, QueryEditorRow } from '.';
import { SELECT_WIDTH } from '../constants';
import CloudMonitoringDatasource from '../datasource';
import { CustomMetaData, MetricQuery, SLOQuery } from '../types';

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
        <AlignmentPeriod
          inputId={`${refId}-alignment-period`}
          selectWidth={SELECT_WIDTH}
          templateVariableOptions={templateVariableOptions}
          query={query}
          onChange={onChange}
        />
      </QueryEditorField>
    </QueryEditorRow>
  );
};
