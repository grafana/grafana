import React, { PureComponent } from 'react';

import { AnnotationEventMappings, AnnotationQueryResponse, DataQuery, LoadingState } from '@grafana/data';
import { Spinner, Icon } from '@grafana/ui';

import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { cx, css } from 'emotion';
import { Props } from './AnnotationQueryEditor';
import { standardAnnotationProcessor } from '../standardAnnotationProcessor';
import { executeAnnotationQuery } from '../annotations_srv';
import { PanelModel } from 'app/features/dashboard/state';

interface State {
  running?: boolean;
  response?: AnnotationQueryResponse;
}

export default class StandardAnnotationQueryEditor extends PureComponent<Props, State> {
  state = {} as State;

  componentDidMount() {
    const { datasource, annotation } = this.props;

    // Handle any migration issues
    const processor = {
      ...standardAnnotationProcessor,
      ...datasource.annotationProcessor,
    };

    const fixed = processor.prepareAnnotation!(annotation);
    if (fixed !== annotation) {
      this.props.change(fixed);
    } else {
      this.runQuery();
    }
  }

  componentDidUpdate(oldProps: Props) {
    if (this.props.annotation !== oldProps.annotation) {
      this.runQuery();
    }
  }

  runQuery = async () => {
    const { datasource, annotation } = this.props;
    console.log('RUN query');

    this.setState({
      running: true,
    });
    const response = await executeAnnotationQuery(
      {
        range: getTimeSrv().timeRange(),
        panel: {} as PanelModel,
        dashboard: getDashboardSrv().getCurrent(),
      },
      datasource,
      annotation
    ).toPromise();

    this.setState({
      running: false,
      response,
    });
  };

  onQueryChange = (query: DataQuery) => {
    this.props.change({
      ...this.props.annotation,
      query,
    });
  };

  onMappingChange = (mappings: AnnotationEventMappings) => {
    this.props.change({
      ...this.props.annotation,
      mappings,
    });
  };

  renderStatus() {
    const { response, running } = this.state;
    if (running || response?.state === LoadingState.Loading) {
      return (
        <div>
          <Spinner />
          Loading...
        </div>
      );
    }
    const { events, error } = response;

    if (error) {
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
          {error.message}
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
    return <div>HELLO!!!! {JSON.stringify(annotation)}</div>;
    // const { response } = this.state;

    // const query = {
    //   rawQuery: true,
    //   ...annotation.query,
    // } as InfluxQuery;

    // return (
    //   <>
    //     <FluxQueryEditor target={query} change={this.onQueryChange} refresh={this.runQuery} />
    //     <br />
    //     {this.renderStatus()}
    //     <br />
    //     <AnnotationFieldMapper
    //       frame={rsp?.data[0]}
    //       options={annotation.mapping}
    //       change={this.onMappingChange}
    //       events={events}
    //     />
    //     <br />
    //   </>
    // );
  }
}
