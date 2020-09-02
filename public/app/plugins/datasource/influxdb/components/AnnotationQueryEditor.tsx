import React, { PureComponent } from 'react';
import coreModule from 'app/core/core_module';
import kbn from 'app/core/utils/kbn';

import { DataSourceApi, AnnotationEvent, DataQueryResponse, LoadingState } from '@grafana/data';
import { AnnotationFieldMapper, AnnotationsFromFrameOptions } from '@grafana/runtime';
import { Spinner, Icon } from '@grafana/ui';

import { InfluxQuery, InfluxAnnotation } from '../types';
import { FluxQueryEditor } from './FluxQueryEditor';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { cx, css } from 'emotion';

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

  renderStatus() {
    const { rsp, running, events } = this.state;
    if (running || rsp?.state === LoadingState.Loading) {
      return (
        <div>
          <Spinner />
          Loading...
        </div>
      );
    }
    if (rsp?.error) {
      return (
        <div
          className={cx(
            'alert-warning',
            css`
              padding: 5px;
            `
          )}
        >
          <Icon name="exclamation-triangle" /> &nbsp;
          {rsp.error.message}
        </div>
      );
    }
    if (events?.length) {
      return <div>No annottions found</div>;
    }
    return <div>Found: {events?.length} annotations</div>;
  }

  render() {
    const { annotation } = this.props;
    const { rsp, events } = this.state;

    const query = {
      rawQuery: true,
      ...annotation.query,
    } as InfluxQuery;

    return (
      <>
        <FluxQueryEditor target={query} change={this.onQueryChange} refresh={this.runQuery} />
        <br />
        {this.renderStatus()}
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
