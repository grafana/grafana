import React from 'react';
import _ from 'lodash';
import appEvents from 'app/core/app_events';

import { MetricPicker } from './MetricPicker';
import { Filter } from './Filter';
import { AggregationPicker } from './AggregationPicker';
import { Target, QueryMeta } from '../types';

export interface Props {
  onQueryChange: (target: Target) => void;
  onExecuteQuery?: () => void;
  target: Target;
  datasource: any;
  templateSrv: any;
  uiSegmentSrv: any;
}

interface State {
  target: Target;
  labelData: QueryMeta;
  loadLabelsPromise: Promise<any>;
}

const DefaultTarget: Target = {
  defaultProject: 'loading project...',
  metricType: '',
  metricKind: '',
  valueType: '',
  refId: '',
  service: '',
  unit: '',
  aggregation: {
    crossSeriesReducer: 'REDUCE_MEAN',
    alignmentPeriod: 'stackdriver-auto',
    perSeriesAligner: 'ALIGN_MEAN',
    groupBys: [],
  },
  filters: [],
  aliasBy: '',
};

export class QueryEditor extends React.Component<Props, State> {
  state: State = { labelData: null, loadLabelsPromise: new Promise(() => {}), target: DefaultTarget };

  componentDidMount() {
    this.getLabels();
    this.setState({ target: this.props.target });
  }

  async getLabels() {
    const loadLabelsPromise = new Promise(async resolve => {
      try {
        const { meta } = await this.props.datasource.getLabels(this.props.target.metricType, this.props.target.refId);
        this.setState({ labelData: meta });
        resolve();
      } catch (error) {
        appEvents.emit('alert-error', ['Error', 'Error loading metric labels for ' + this.props.target.metricType]);
        resolve();
      }
    });
    this.setState({ loadLabelsPromise });
  }

  handleMetricTypeChange({ valueType, metricKind, type, unit }) {
    this.setState({
      target: {
        ...this.state.target,
        ...{
          metricType: type,
          unit,
          valueType,
          metricKind,
        },
      },
    });

    // this.$rootScope.$broadcast('metricTypeChanged');
    this.getLabels();
    this.props.onQueryChange(this.state.target);
    this.props.onExecuteQuery();
  }

  handleFilterChange(value) {
    this.setState({
      target: {
        ...this.state.target,
        filters: value,
      },
    });
    this.props.onQueryChange(this.state.target);
    this.props.onExecuteQuery();
  }

  handleGroupBysChange(value) {
    this.setState({
      target: {
        ...this.state.target,
        groupBys: value,
      },
    });
    this.props.onQueryChange(this.state.target);
    this.props.onExecuteQuery();
  }

  handleAggregationChange(value) {
    this.setState({
      target: {
        ...this.state.target,
        aggregation: {
          ...this.state.target.aggregation,
          crossSeriesReducer: value,
        },
      },
    });
    this.props.onQueryChange(this.state.target);
    this.props.onExecuteQuery();
  }

  render() {
    const { labelData, loadLabelsPromise, target } = this.state;
    const { defaultProject, metricType, valueType, metricKind, aggregation } = target;
    const { templateSrv, datasource, uiSegmentSrv } = this.props;

    return (
      <React.Fragment>
        <MetricPicker
          defaultProject={defaultProject}
          metricType={metricType}
          templateSrv={templateSrv}
          datasource={datasource}
          onChange={value => this.handleMetricTypeChange(value)}
        />
        <Filter
          filtersChanged={value => this.handleFilterChange(value)}
          groupBysChanged={value => this.handleGroupBysChange(value)}
          target={target}
          uiSegmentSrv={uiSegmentSrv}
          labelData={labelData}
          templateSrv={templateSrv}
          loading={loadLabelsPromise}
        />
        <AggregationPicker
          valueType={valueType}
          metricKind={metricKind}
          templateSrv={templateSrv}
          aggregation={aggregation}
          onChange={value => this.handleAggregationChange(value)}
        />
        {/* target="ctrl.target" refresh="ctrl.refresh()" loading="ctrl.loadLabelsPromise" label-data="ctrl.labelData" */}
        {/* <stackdriver-filter
          target="target"
          refresh="target.refresh()"
          loading="target.loadLabelsPromise"
          label-data="target.labelData"
        />
        <aggregation-picker
          value-type="target.target.valueType"
          metric-kind="target.target.metricKind"
          aggregation="target.target.aggregation"
          alignment-period="target.lastQueryMeta.alignmentPeriod"
          refresh="target.refresh()"
          template-srv="target.templateSrv"
          datasource="target.datasource"
          on-change="target.handleAggregationChange"
        />

        <stackdriver-aggregation
          target="target.target"
          alignment-period="target.lastQueryMeta.alignmentPeriod"
          refresh="target.refresh()"
        /> */}
      </React.Fragment>
    );
  }
}
