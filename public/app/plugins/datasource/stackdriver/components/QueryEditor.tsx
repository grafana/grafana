import React from 'react';

import { TemplateSrv } from 'app/features/templating/template_srv';

import { Project, Aggregations, Metrics, Filters, GroupBys, Alignments, AlignmentPeriods, AliasBy, Help } from './';
import { StackdriverQuery, MetricDescriptor } from '../types';
import { getAlignmentPickerData, toOption } from '../functions';
import StackdriverDatasource from '../datasource';
import { PanelEvents, SelectableValue, TimeSeries } from '@grafana/data';

export interface Props {
  onQueryChange: (target: StackdriverQuery) => void;
  onExecuteQuery: () => void;
  target: StackdriverQuery;
  events: any;
  datasource: StackdriverDatasource;
  templateSrv: TemplateSrv;
}

interface State extends StackdriverQuery {
  variableOptions: Array<SelectableValue<string>>;
  variableOptionGroup: SelectableValue<string>;
  alignOptions: Array<SelectableValue<string>>;
  lastQuery: string;
  lastQueryError: string;
  labels: any;
  [key: string]: any;
}

export const DefaultTarget: State = {
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
  filter: [],
  aliasBy: '',
  alignOptions: [],
  lastQuery: '',
  lastQueryError: '',
  usedAlignmentPeriod: '',
  labels: {},
  variableOptionGroup: {},
  variableOptions: [],
};

export class QueryEditor extends React.Component<Props, State> {
  state: State = DefaultTarget;

  async componentDidMount() {
    const { events, target, templateSrv, datasource } = this.props;
    await datasource.ensureGCEDefaultProject();
    if (!target.projectName) {
      target.projectName = datasource.getDefaultProject();
    }

    events.on(PanelEvents.dataReceived, this.onDataReceived.bind(this));
    events.on(PanelEvents.dataError, this.onDataError.bind(this));

    const { perSeriesAligner, alignOptions } = getAlignmentPickerData(target, templateSrv);
    const variableOptionGroup = {
      label: 'Template Variables',
      expanded: false,
      options: datasource.variables.map(toOption),
    };

    const state: Partial<State> = {
      ...this.props.target,
      projectName: target.projectName,
      alignOptions,
      perSeriesAligner,
      variableOptionGroup,
      variableOptions: variableOptionGroup.options,
    };

    this.setState(state);

    datasource
      .getLabels(target.metricType, target.refId, target.projectName, target.groupBys)
      .then(labels => this.setState({ labels }));
  }

  componentWillUnmount() {
    this.props.events.off(PanelEvents.dataReceived, this.onDataReceived);
    this.props.events.off(PanelEvents.dataError, this.onDataError);
  }

  onDataReceived(dataList: TimeSeries[]) {
    const series = dataList.find((item: any) => item.refId === this.props.target.refId);
    if (series) {
      this.setState({
        lastQuery: decodeURIComponent(series.meta.rawQuery),
        lastQueryError: '',
        usedAlignmentPeriod: series.meta.alignmentPeriod,
      });
    }
  }

  onDataError(err: any) {
    let lastQuery;
    let lastQueryError;
    if (err.data && err.data.error) {
      lastQueryError = this.props.datasource.formatStackdriverError(err);
    } else if (err.data && err.data.results) {
      const queryRes = err.data.results[this.props.target.refId];
      lastQuery = decodeURIComponent(queryRes.meta.rawQuery);
      if (queryRes && queryRes.error) {
        try {
          lastQueryError = JSON.parse(queryRes.error).error.message;
        } catch {
          lastQueryError = queryRes.error;
        }
      }
    }
    this.setState({ lastQuery, lastQueryError });
  }

  onMetricTypeChange = async ({ valueType, metricKind, type, unit }: MetricDescriptor) => {
    const { templateSrv, onQueryChange, onExecuteQuery, target } = this.props;
    const { perSeriesAligner, alignOptions } = getAlignmentPickerData(
      { valueType, metricKind, perSeriesAligner: this.state.perSeriesAligner },
      templateSrv
    );
    const labels = await this.props.datasource.getLabels(type, target.refId, this.state.projectName, target.groupBys);
    this.setState(
      {
        alignOptions,
        perSeriesAligner,
        metricType: type,
        unit,
        valueType,
        metricKind,
        labels,
      },
      () => {
        onQueryChange(this.state);
        if (this.state.projectName !== null) {
          onExecuteQuery();
        }
      }
    );
  };

  onGroupBysChange(value: string[]) {
    const { target, datasource } = this.props;
    this.setState({ groupBys: value }, () => {
      this.props.onQueryChange(this.state);
      this.props.onExecuteQuery();
    });
    datasource
      .getLabels(target.metricType, target.refId, this.state.projectName, value)
      .then(labels => this.setState({ labels }));
  }

  onPropertyChange(prop: string, value: any) {
    this.setState({ [prop]: value }, () => {
      this.props.onQueryChange(this.state);
      if (this.state.projectName !== null) {
        this.props.onExecuteQuery();
      }
    });
  }

  render() {
    const {
      groupBys = [],
      filters = [],
      usedAlignmentPeriod,
      projectName,
      metricType,
      crossSeriesReducer,
      perSeriesAligner,
      alignOptions,
      alignmentPeriod,
      aliasBy,
      lastQuery,
      lastQueryError,
      labels,
      variableOptionGroup,
      variableOptions,
      refId,
    } = this.state;
    const { datasource, templateSrv } = this.props;

    return (
      <>
        <Project
          templateVariableOptions={variableOptions}
          projectName={projectName}
          datasource={datasource}
          onChange={value => {
            this.onPropertyChange('projectName', value);
            datasource.getLabels(metricType, refId, value, groupBys).then(labels => this.setState({ labels }));
          }}
        />
        <Metrics
          templateSrv={templateSrv}
          projectName={projectName}
          metricType={metricType}
          templateVariableOptions={variableOptions}
          datasource={datasource}
          onChange={this.onMetricTypeChange}
        >
          {metric => (
            <>
              <Filters
                labels={labels}
                filters={filters}
                onChange={value => this.onPropertyChange('filters', value)}
                variableOptionGroup={variableOptionGroup}
              />
              <GroupBys
                groupBys={Object.keys(labels)}
                values={groupBys}
                onChange={this.onGroupBysChange.bind(this)}
                variableOptionGroup={variableOptionGroup}
              />
              <Aggregations
                metricDescriptor={metric}
                templateVariableOptions={variableOptions}
                crossSeriesReducer={crossSeriesReducer}
                groupBys={groupBys}
                onChange={value => this.onPropertyChange('crossSeriesReducer', value)}
              >
                {displayAdvancedOptions =>
                  displayAdvancedOptions && (
                    <Alignments
                      alignOptions={alignOptions}
                      templateVariableOptions={variableOptions}
                      perSeriesAligner={perSeriesAligner}
                      onChange={value => this.onPropertyChange('perSeriesAligner', value)}
                    />
                  )
                }
              </Aggregations>
              <AlignmentPeriods
                templateSrv={templateSrv}
                templateVariableOptions={variableOptions}
                alignmentPeriod={alignmentPeriod}
                perSeriesAligner={perSeriesAligner}
                usedAlignmentPeriod={usedAlignmentPeriod}
                onChange={value => this.onPropertyChange('alignmentPeriod', value)}
              />
              <AliasBy value={aliasBy} onChange={value => this.onPropertyChange('aliasBy', value)} />
              <Help rawQuery={lastQuery} lastQueryError={lastQueryError} />
            </>
          )}
        </Metrics>
      </>
    );
  }
}
