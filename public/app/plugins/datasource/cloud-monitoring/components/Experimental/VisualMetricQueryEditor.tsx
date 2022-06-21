import React from 'react';

import { SelectableValue } from '@grafana/data';

import CloudMonitoringDatasource from '../../datasource';
import { CustomMetaData, MetricDescriptor, MetricQuery, SLOQuery } from '../../types';
import { LabelFilter, Metrics } from '../index';

import { Alignment } from './Alignment';
import { GroupBy } from './GroupBy';
import { Preprocessor } from './Preprocessor';

export interface Props {
  refId: string;
  customMetaData: CustomMetaData;
  variableOptionGroup: SelectableValue<string>;
  onMetricTypeChange: (query: MetricDescriptor) => void;
  onChange: (query: MetricQuery | SLOQuery) => void;
  query: MetricQuery;
  datasource: CloudMonitoringDatasource;
  labels: any;
}

function Editor({
  refId,
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
      refId={refId}
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
            refId={refId}
            labels={Object.keys(labels)}
            query={query}
            onChange={onChange}
            variableOptionGroup={variableOptionGroup}
            metricDescriptor={metric}
          />
          <Alignment
            refId={refId}
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
