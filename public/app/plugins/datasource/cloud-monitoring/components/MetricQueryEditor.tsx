import React, { useState, useEffect } from 'react';
import { Project, Aggregations, Metrics, LabelFilter, GroupBys, Alignments, AlignmentPeriods, AliasBy } from '.';
import { MetricQuery, MetricDescriptor } from '../types';
import { getAlignmentPickerData } from '../functions';
import CloudMonitoringDatasource from '../datasource';
import { SelectableValue } from '@grafana/data';

export interface Props {
  refId: string;
  usedAlignmentPeriod?: number;
  variableOptionGroup: SelectableValue<string>;
  onChange: (query: MetricQuery) => void;
  onRunQuery: () => void;
  query: MetricQuery;
  datasource: CloudMonitoringDatasource;
}

interface State {
  labels: any;
  [key: string]: any;
}

export const defaultState: State = {
  labels: {},
};

export const defaultQuery: MetricQuery = {
  projectName: '',
  metricType: '',
  metricKind: '',
  valueType: '',
  unit: '',
  crossSeriesReducer: 'REDUCE_MEAN',
  alignmentPeriod: 'cloud-monitoring-auto',
  perSeriesAligner: 'ALIGN_MEAN',
  groupBys: [],
  filters: [],
  aliasBy: '',
};

function Editor({
  refId,
  query,
  datasource,
  onChange,
  usedAlignmentPeriod,
  variableOptionGroup,
}: React.PropsWithChildren<Props>) {
  const [state, setState] = useState<State>(defaultState);

  useEffect(() => {
    if (query && query.projectName && query.metricType) {
      datasource
        .getLabels(query.metricType, refId, query.projectName, query.groupBys)
        .then(labels => setState({ ...state, labels }));
    }
  }, [query.projectName, query.groupBys, query.metricType]);

  const onMetricTypeChange = async ({ valueType, metricKind, type, unit }: MetricDescriptor) => {
    const { perSeriesAligner, alignOptions } = getAlignmentPickerData(
      { valueType, metricKind, perSeriesAligner: state.perSeriesAligner },
      datasource.templateSrv
    );
    setState({
      ...state,
      alignOptions,
    });
    onChange({ ...query, perSeriesAligner, metricType: type, unit, valueType, metricKind });
  };

  const { labels } = state;
  const { perSeriesAligner, alignOptions } = getAlignmentPickerData(query, datasource.templateSrv);

  return (
    <>
      <Project
        templateVariableOptions={variableOptionGroup.options}
        projectName={query.projectName}
        datasource={datasource}
        onChange={projectName => {
          onChange({ ...query, projectName });
        }}
      />
      <Metrics
        templateSrv={datasource.templateSrv}
        projectName={query.projectName}
        metricType={query.metricType}
        templateVariableOptions={variableOptionGroup.options}
        datasource={datasource}
        onChange={onMetricTypeChange}
      >
        {metric => (
          <>
            <LabelFilter
              labels={labels}
              filters={query.filters!}
              onChange={filters => onChange({ ...query, filters })}
              variableOptionGroup={variableOptionGroup}
            />
            <GroupBys
              groupBys={Object.keys(labels)}
              values={query.groupBys!}
              onChange={groupBys => onChange({ ...query, groupBys })}
              variableOptionGroup={variableOptionGroup}
            />
            <Aggregations
              metricDescriptor={metric}
              templateVariableOptions={variableOptionGroup.options}
              crossSeriesReducer={query.crossSeriesReducer}
              groupBys={query.groupBys!}
              onChange={crossSeriesReducer => onChange({ ...query, crossSeriesReducer })}
            >
              {displayAdvancedOptions =>
                displayAdvancedOptions && (
                  <Alignments
                    alignOptions={alignOptions}
                    templateVariableOptions={variableOptionGroup.options}
                    perSeriesAligner={perSeriesAligner || ''}
                    onChange={perSeriesAligner => onChange({ ...query, perSeriesAligner })}
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
              onChange={alignmentPeriod => onChange({ ...query, alignmentPeriod })}
            />
            <AliasBy value={query.aliasBy || ''} onChange={aliasBy => onChange({ ...query, aliasBy })} />
          </>
        )}
      </Metrics>
    </>
  );
}

export const MetricQueryEditor = React.memo(Editor);
