import React from 'react';
import _ from 'lodash';
import appEvents from 'app/core/app_events';

import { MetricPicker } from './MetricPicker';
import { Filter } from './Filter';
// import { AggregationPicker } from './AggregationPicker';
import { Target, QueryMeta } from '../types';

export interface Props {
  onChange: (target: Target) => void;
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
  metricKind: '',
  valueType: '',
};

export class QueryEditor extends React.Component<Props, State> {
  state: State = { labelData: null, loadLabelsPromise: null, target: DefaultTarget };

  constructor(props) {
    super(props);
    this.handleMetricTypeChange = this.handleMetricTypeChange.bind(this);
    this.handleAggregationChange = this.handleAggregationChange.bind(this);
  }

  componentDidMount() {
    this.setState({ target: this.props.target });
    this.getLabels();
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
    // this.getLabels();
    // this.refresh();
  }

  handleAggregationChange(crossSeriesReducer) {
    // this.target.aggregation.crossSeriesReducer = crossSeriesReducer;
    // this.refresh();
  }

  render() {
    const { labelData, loadLabelsPromise, target } = this.state;
    const { defaultProject, metricType } = target;
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
          onChange={() => console.log('change filter')}
          target={target}
          uiSegmentSrv={uiSegmentSrv}
          labelData={labelData}
          templateSrv={templateSrv}
          loading={loadLabelsPromise}
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
