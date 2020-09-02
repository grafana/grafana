import React, { Component } from 'react';
import coreModule from 'app/core/core_module';

import { AnnotationQueryRequest, DataSourceApi } from '@grafana/data';
import { AnnotationFieldMapper, AnnotationsFromFrameOptions } from '@grafana/runtime';

import { InfluxQuery } from '../types';
import { FluxQueryEditor } from './FluxQueryEditor';

interface Props {
  datasource: DataSourceApi;
  annotation: AnnotationQueryRequest<InfluxQuery>;
  change: (query: AnnotationQueryRequest<InfluxQuery>) => void;
}

export class AnnotationQueryEditor extends Component<Props> {
  onChange = (query: InfluxQuery) => {
    const { annotation } = this.props;
    this.props.change({
      ...annotation,
      annotation: {
        ...annotation.annotation,
        ...query,
      } as any,
    });
  };

  onRefresh = () => {
    // noop?
  };

  onMappingChange = (options: AnnotationsFromFrameOptions) => {
    console.log('TODO... upddate', options);
  };

  render() {
    const { annotation } = this.props;

    const mapping: AnnotationsFromFrameOptions = {};

    const query = {
      rawQuery: true,
      ...annotation.annotation,
    };
    return (
      <>
        <FluxQueryEditor target={query} change={this.onChange} refresh={this.onRefresh} />
        <br />
        <br />
        <AnnotationFieldMapper data={undefined} options={mapping} change={this.onMappingChange} />
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
