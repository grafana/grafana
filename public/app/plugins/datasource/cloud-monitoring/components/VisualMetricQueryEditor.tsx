import React from 'react';
import { SelectableValue } from '@grafana/data';
import { Metrics, LabelFilter, GroupBy, Preprocessor, Alignment } from '.';
import { MetricQuery, MetricDescriptor, CustomMetaData } from '../types';
import CloudMonitoringDatasource from '../datasource';

export interface Props {
  customMetaData: CustomMetaData;
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
  customMetaData,
  variableOptionGroup,
}: React.PropsWithChildren<Props>) {
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
            onChange={(filters: string[]) => onChange({ ...query, filters })}
            variableOptionGroup={variableOptionGroup}
          />
          <Preprocessor metricDescriptor={metric} query={query} onChange={onChange} />
          <GroupBy
            labels={Object.keys(labels)}
            query={query}
            onChange={onChange}
            variableOptionGroup={variableOptionGroup}
            metricDescriptor={metric}
          />
          <Alignment
            datasource={datasource}
            templateVariableOptions={variableOptionGroup.options}
            query={query}
            customMetaData={customMetaData}
            onChange={onChange}
          />
        </>
      )}
    </Metrics>
  );
}

export const VisualMetricQueryEditor = React.memo(Editor);
