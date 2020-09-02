import React, { PureComponent } from 'react';
import coreModule from 'app/core/core_module';
import kbn from 'app/core/utils/kbn';

import { DataSourceApi, AnnotationEvent, DataQueryResponse } from '@grafana/data';
import { AnnotationFieldMapper, AnnotationsFromFrameOptions } from '@grafana/runtime';

import { InfluxQuery, InfluxAnnotation } from '../types';
import { FluxQueryEditor } from './FluxQueryEditor';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';

interface Props {
  datasource: DataSourceApi;
  annotation: InfluxAnnotation;
  change: (query: InfluxAnnotation) => void;
}

interface State {
  running?: boolean;
  rsp?: DataQueryResponse;
  events?: AnnotationEvent[];
}

export class AnnotationQueryEditor extends PureComponent<Props, State> {
  state = {} as State;

  componentDidMount() {
    this.runQuery();
  }

  componentDidUpdate(oldProps: Props) {
    if (this.props.annotation !== oldProps.annotation) {
      this.runQuery();
    }
  }

  runQuery = async () => {
    const { datasource, annotation } = this.props;
    console.log('RUN query');

    // No more points than pixels
    const maxDataPoints = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;

    const range = getTimeSrv().timeRange();

    // Add interval to annotation queries
    const interval = kbn.calculateInterval(range, maxDataPoints, datasource.interval);

    const annoRequest = {
      ...interval,
      app: 'editor',
      range,
      rangeRaw: range.raw,
      annotation,
      dashboard: getDashboardSrv().getCurrent(),
    };
    this.setState({
      running: true,
    });

    // @ts-ignore generic annotation is composite ¯\_(ツ)_/¯
    const events = await datasource.annotationQuery!(annoRequest);

    // @ts-ignore
    const rsp = window.lastAnnotationResponse as DataQueryResponse;
    // @ts-ignore
    window.lastAnnotationResponse = undefined;
    this.setState({ running: false, events, rsp });
  };

  onQueryChange = (query: InfluxQuery) => {
    this.props.change({
      ...this.props.annotation,
      query,
    });
  };

  onMappingChange = (mapping: AnnotationsFromFrameOptions) => {
    this.props.change({
      ...this.props.annotation,
      mapping,
    });
  };

  render() {
    const { annotation } = this.props;
    const { rsp, running, events } = this.state;

    const query = {
      rawQuery: true,
      ...annotation.query,
    } as InfluxQuery;

    return (
      <>
        <FluxQueryEditor target={query} change={this.onQueryChange} refresh={this.runQuery} />
        <br />
        {running ? <div>Running...</div> : <div>FOUND: {events?.length}</div>}
        <br />
        <AnnotationFieldMapper
          frame={rsp?.data[0]}
          options={annotation.mapping}
          change={this.onMappingChange}
          events={events}
        />
        <br />
      </>
    );
  }
}

coreModule.directive('fluxAnnotationEditor', [
  'reactDirective',
  (reactDirective: any) => {
    return reactDirective(AnnotationQueryEditor, ['annotation', 'datasource', 'change']);
  },
]);
