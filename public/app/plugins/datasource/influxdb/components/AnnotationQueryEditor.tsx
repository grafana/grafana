import React, { PureComponent } from 'react';
import coreModule from 'app/core/core_module';

import { DataSourceApi } from '@grafana/data';
import { AnnotationFieldMapper, AnnotationsFromFrameOptions } from '@grafana/runtime';

import { InfluxQuery, InfluxAnnotation } from '../types';
import { FluxQueryEditor } from './FluxQueryEditor';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import kbn from 'app/core/utils/kbn';
import { AnnotationResults } from '@grafana/runtime/src/utils/annotationsFromDataFrame';

interface Props {
  datasource: DataSourceApi;
  annotation: InfluxAnnotation;
  change: (query: InfluxAnnotation) => void;
}

interface State {
  info?: AnnotationResults;
}

export class AnnotationQueryEditor extends PureComponent<Props, State> {
  state = {} as State;

  componentDidMount() {
    this.runQuery();
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
      range,
      rangeRaw: range.raw,
      annotation: annotation,
      dashboard: getDashboardSrv().getCurrent(),
      isEditor: true, // flag to set global metadata
    };
    console.log('Test query', annoRequest);
    await datasource.annotationQuery!(annoRequest);

    // @ts-ignore
    const info = window.lastAnnotationQuery as AnnotationResults;
    // @ts-ignore
    window.lastAnnotationQuery = undefined;
    this.setState({ info });
  };

  onQueryChange = (query: InfluxQuery) => {
    this.props.change({
      ...this.props.annotation,
      query,
    });
    this.runQuery();
  };

  onMappingChange = (mapping: AnnotationsFromFrameOptions) => {
    this.props.change({
      ...this.props.annotation,
      mapping,
    });
    this.runQuery();
  };

  render() {
    const { annotation } = this.props;
    const { info } = this.state;

    const query = {
      rawQuery: true,
      ...annotation.query,
    } as InfluxQuery;

    return (
      <>
        <FluxQueryEditor target={query} change={this.onQueryChange} refresh={this.runQuery} />
        <br />
        <AnnotationFieldMapper data={info?.frame} options={annotation.mapping} change={this.onMappingChange} />
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

// target: InfluxQuery;
// change: (target: InfluxQuery) => void;
// refresh: () => void;
