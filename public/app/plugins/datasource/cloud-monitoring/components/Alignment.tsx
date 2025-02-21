import { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup } from '@grafana/plugin-ui';

import { ALIGNMENT_PERIODS } from '../constants';
import CloudMonitoringDatasource from '../datasource';
import { alignmentPeriodLabel } from '../functions';
import { PreprocessorType, TimeSeriesList } from '../types/query';
import { CustomMetaData, MetricDescriptor } from '../types/types';

import { AlignmentFunction } from './AlignmentFunction';
import { PeriodSelect } from './PeriodSelect';

export interface Props {
  refId: string;
  onChange: (query: TimeSeriesList) => void;
  query: TimeSeriesList;
  templateVariableOptions: Array<SelectableValue<string>>;
  customMetaData: CustomMetaData;
  datasource: CloudMonitoringDatasource;
  metricDescriptor?: MetricDescriptor;
  preprocessor?: PreprocessorType;
}

export const Alignment = ({
  refId,
  templateVariableOptions,
  onChange,
  query,
  customMetaData,
  datasource,
  metricDescriptor,
  preprocessor,
}: Props) => {
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
          onChange={(q) => onChange({ ...query, ...q })}
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
