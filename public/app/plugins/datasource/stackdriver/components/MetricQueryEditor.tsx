import React, { useState, useEffect } from 'react';

import events from 'app/core/app_events';

import { Project, Aggregations, Metrics, LabelFilter, GroupBys, Alignments, AlignmentPeriods, AliasBy, Help } from '.';
import { MetricQuery, MetricDescriptor } from '../types';
import { getAlignmentPickerData, toOption } from '../functions';
import StackdriverDatasource from '../datasource';
import { PanelEvents, SelectableValue, TimeSeries } from '@grafana/data';

export interface Props {
  refId: string;
  onChange: (query: MetricQuery) => void;
  onRunQuery: () => void;
  query: MetricQuery;
  datasource: StackdriverDatasource;
}

interface State {
  variableOptions: Array<SelectableValue<string>>;
  variableOptionGroup: SelectableValue<string>;
  alignOptions: Array<SelectableValue<string>>;
  lastQuery: string;
  lastQueryError: string;
  labels: any;
  [key: string]: any;
}

export const defaultState: State = {
  lastQueryError: '',
  usedAlignmentPeriod: '',
  alignOptions: [],
  lastQuery: '',
  labels: {},
  variableOptionGroup: {},
  variableOptions: [],
};

export const defaultQuery: MetricQuery = {
  projectName: '',
  metricType: '',
  metricKind: '',
  valueType: '',
  refId: '',
  service: '',
  unit: '',
  crossSeriesReducer: 'REDUCE_MEAN',
  alignmentPeriod: 'stackdriver-auto',
  perSeriesAligner: 'ALIGN_MEAN',
  groupBys: [],
  filters: [],
  aliasBy: '',
};

function Editor({ refId, query, datasource, onChange, onRunQuery = () => {} }: React.PropsWithChildren<Props>) {
  const [state, setState] = useState<State>(defaultState);

  useEffect(() => {
    events.on(PanelEvents.dataReceived, onDataReceived);
    events.on(PanelEvents.dataError, onDataError);

    const variableOptionGroup = {
      label: 'Template Variables',
      expanded: false,
      options: datasource.variables.map(toOption),
    };

    setState({ ...state, variableOptionGroup, variableOptions: variableOptionGroup.options });

    return () => {
      events.off(PanelEvents.dataReceived, onDataReceived);
      events.off(PanelEvents.dataError, onDataError);
    };
  }, []);

  useEffect(() => {
    if (query) {
      const { perSeriesAligner, alignOptions } = getAlignmentPickerData(query, datasource.templateSrv);

      setState({
        ...state,
        alignOptions,
        perSeriesAligner,
      });

      datasource
        .getLabels(query.metricType, refId, query.projectName, query.groupBys)
        .then(labels => setState({ ...state, labels }));
    }
  }, [query]);

  const onDataReceived = (dataList: TimeSeries[]) => {
    const series = dataList.find((item: any) => item.refId === refId);
    if (series) {
      setState({
        ...state,
        lastQuery: decodeURIComponent(series.meta.rawQuery),
        lastQueryError: '',
        usedAlignmentPeriod: series.meta.alignmentPeriod,
      });
    }
  };

  const onDataError = (err: any) => {
    let lastQuery;
    let lastQueryError;
    if (err.data && err.data.error) {
      lastQueryError = datasource.formatStackdriverError(err);
    } else if (err.data && err.data.results) {
      const queryRes = err.data.results[refId];
      lastQuery = decodeURIComponent(queryRes.meta.rawQuery);
      if (queryRes && queryRes.error) {
        try {
          lastQueryError = JSON.parse(queryRes.error).error.message;
        } catch {
          lastQueryError = queryRes.error;
        }
      }
    }
    setState({ ...state, lastQuery, lastQueryError });
  };

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

  const {
    lastQuery,
    lastQueryError,
    labels,
    variableOptionGroup,
    variableOptions,
    usedAlignmentPeriod,
    alignOptions,
  } = state;

  console.log('render metricqueryeditor');

  return (
    <>
      <Project
        templateVariableOptions={variableOptions}
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
        templateVariableOptions={variableOptions}
        datasource={datasource}
        onChange={onMetricTypeChange}
      >
        {metric => (
          <>
            <LabelFilter
              labels={labels}
              filters={query.filters}
              onChange={filters => onChange({ ...query, filters })}
              variableOptionGroup={variableOptionGroup}
            />
            <GroupBys
              groupBys={Object.keys(labels)}
              values={query.groupBys}
              onChange={groupBys => onChange({ ...query, groupBys })}
              variableOptionGroup={variableOptionGroup}
            />
            <Aggregations
              metricDescriptor={metric}
              templateVariableOptions={variableOptions}
              crossSeriesReducer={query.crossSeriesReducer}
              groupBys={query.groupBys}
              onChange={crossSeriesReducer => onChange({ ...query, crossSeriesReducer })}
            >
              {displayAdvancedOptions =>
                displayAdvancedOptions && (
                  <Alignments
                    alignOptions={alignOptions}
                    templateVariableOptions={variableOptions}
                    perSeriesAligner={query.perSeriesAligner}
                    onChange={perSeriesAligner => onChange({ ...query, perSeriesAligner })}
                  />
                )
              }
            </Aggregations>
            <AlignmentPeriods
              templateSrv={datasource.templateSrv}
              templateVariableOptions={variableOptions}
              alignmentPeriod={query.alignmentPeriod}
              perSeriesAligner={query.perSeriesAligner}
              usedAlignmentPeriod={usedAlignmentPeriod}
              onChange={alignmentPeriod => onChange({ ...query, alignmentPeriod })}
            />
            <AliasBy value={query.aliasBy} onChange={aliasBy => onChange({ ...query, aliasBy })} />
            <Help rawQuery={lastQuery} lastQueryError={lastQueryError} />
          </>
        )}
      </Metrics>
    </>
  );
}

export const MetricQueryEditor = React.memo(Editor);
