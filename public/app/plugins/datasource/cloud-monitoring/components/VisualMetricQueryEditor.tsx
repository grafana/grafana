import React from 'react';
import { Aggregations, Metrics, LabelFilter, GroupBys, Alignments, AlignmentPeriods } from '.';
import { MetricQuery, MetricDescriptor } from '../types';
import { getAlignmentPickerData } from '../functions';
import CloudMonitoringDatasource from '../datasource';
import { SelectableValue } from '@grafana/data';

export interface Props {
  usedAlignmentPeriod?: number;
  variableOptionGroup: SelectableValue<string>;
  onMetricTypeChange: (query: MetricDescriptor) => void;
  onChange: (query: MetricQuery) => void;
  query: MetricQuery;
  datasource: CloudMonitoringDatasource;
  labels: any;
}

function Editor({
  query,
  labels,
  datasource,
  onChange,
  onMetricTypeChange,
  usedAlignmentPeriod,
  variableOptionGroup,
}: React.PropsWithChildren<Props>) {
  const { perSeriesAligner, alignOptions } = getAlignmentPickerData(query, datasource.templateSrv);

  return (
    <Metrics
      templateSrv={datasource.templateSrv}
      projectName={query.projectName}
      metricType={query.metricType}
      templateVariableOptions={variableOptionGroup.options}
      datasource={datasource}
      onChange={onMetricTypeChange}
    >
      {(metric) => (
        <>
          <LabelFilter
            labels={labels}
            filters={query.filters!}
            onChange={(filters) => onChange({ ...query, filters })}
            variableOptionGroup={variableOptionGroup}
          />
          <GroupBys
            groupBys={Object.keys(labels)}
            values={query.groupBys!}
            onChange={(groupBys) => onChange({ ...query, groupBys })}
            variableOptionGroup={variableOptionGroup}
          />
          <Aggregations
            metricDescriptor={metric}
            templateVariableOptions={variableOptionGroup.options}
            crossSeriesReducer={query.crossSeriesReducer}
            groupBys={query.groupBys!}
            onChange={(crossSeriesReducer) => onChange({ ...query, crossSeriesReducer })}
          >
            {(displayAdvancedOptions) =>
              displayAdvancedOptions && (
                <Alignments
                  alignOptions={alignOptions}
                  templateVariableOptions={variableOptionGroup.options}
                  perSeriesAligner={perSeriesAligner || ''}
                  onChange={(perSeriesAligner) => onChange({ ...query, perSeriesAligner })}
                />
              )
            }
          </Aggregations>
          <AlignmentPeriods
            templateSrv={datasource.templateSrv}
            templateVariableOptions={variableOptionGroup.options}
            alignmentPeriod={query.alignmentPeriod || ''}
            perSeriesAligner={query.perSeriesAligner || ''}
            usedAlignmentPeriod={usedAlignmentPeriod}
            onChange={(alignmentPeriod) => onChange({ ...query, alignmentPeriod })}
          />
        </>
      )}
    </Metrics>
  );
}

export const VisualMetricQueryEditor = React.memo(Editor);
