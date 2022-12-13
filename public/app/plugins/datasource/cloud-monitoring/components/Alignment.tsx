import React, { FC, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup } from '@grafana/experimental';

import { ALIGNMENT_PERIODS } from '../constants';
import CloudMonitoringDatasource from '../datasource';
import { alignmentPeriodLabel } from '../functions';
import { CustomMetaData, MetricDescriptor, PreprocessorType, SLOQuery, TimeSeriesList } from '../types';

import { AlignmentFunction } from './AlignmentFunction';
import { PeriodSelect } from './PeriodSelect';

export interface Props {
  refId: string;
  onChange: (query: TimeSeriesList | SLOQuery) => void;
  query: TimeSeriesList | SLOQuery;
  templateVariableOptions: Array<SelectableValue<string>>;
  customMetaData: CustomMetaData;
  datasource: CloudMonitoringDatasource;
  metricDescriptor?: MetricDescriptor;
  preprocessor?: PreprocessorType;
}

export const Alignment: FC<Props> = ({
  refId,
  templateVariableOptions,
  onChange,
  query,
  customMetaData,
  datasource,
  metricDescriptor,
  preprocessor,
}) => {
  const alignmentLabel = useMemo(() => alignmentPeriodLabel(customMetaData, datasource), [customMetaData, datasource]);
  return (
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
          metricDescriptor={metricDescriptor}
          preprocessor={preprocessor}
        />
      </EditorField>
      <EditorField label="Alignment period" tooltip={alignmentLabel}>
        <PeriodSelect
          inputId={`${refId}-alignment-period`}
          templateVariableOptions={templateVariableOptions}
          current={query.alignmentPeriod}
          onChange={(period) => onChange({ ...query, alignmentPeriod: period })}
          aligmentPeriods={ALIGNMENT_PERIODS}
        />
      </EditorField>
    </EditorFieldGroup>
  );
};
