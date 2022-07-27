import React, { FC } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorRow, EditorFieldGroup, EditorField, Stack } from '@grafana/ui';

import { ALIGNMENT_PERIODS, SELECT_WIDTH } from '../../constants';
import CloudMonitoringDatasource from '../../datasource';
import { CustomMetaData, MetricQuery, SLOQuery } from '../../types';

import { AlignmentFunction } from './AlignmentFunction';
import { AlignmentPeriodLabel } from './AlignmentPeriodLabel';
import { PeriodSelect } from './PeriodSelect';

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
    <EditorRow>
      <EditorFieldGroup>
        <EditorField
          label="Alignment function"
          tooltip="The process of alignment consists of collecting all data points received in a fixed length of time, applying a function to combine those data points, and assigning a timestamp to the result."
        >
          <AlignmentFunction
            inputId={`${refId}-alignment-function`}
            templateVariableOptions={templateVariableOptions}
            query={query}
            onChange={onChange}
          />
        </EditorField>
        <EditorField label="Alignment period">
          <PeriodSelect
            inputId={`${refId}-alignment-period`}
            selectWidth={SELECT_WIDTH}
            templateVariableOptions={templateVariableOptions}
            current={query.alignmentPeriod}
            onChange={(period) => onChange({ ...query, alignmentPeriod: period })}
            aligmentPeriods={ALIGNMENT_PERIODS}
          />
        </EditorField>
        <Stack alignItems="flex-end">
          <AlignmentPeriodLabel datasource={datasource} customMetaData={customMetaData} />
        </Stack>
      </EditorFieldGroup>
    </EditorRow>
  );
};
