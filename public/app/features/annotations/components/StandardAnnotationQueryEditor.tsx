import React, { PureComponent } from 'react';

import { AnnotationEventMappings, DataQuery, LoadingState } from '@grafana/data';
import { Spinner, Icon } from '@grafana/ui';

import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { cx, css } from 'emotion';
import { Props } from './AnnotationQueryEditor';
import { standardAnnotationSupport } from '../standardAnnotationSupport';
import { executeAnnotationQuery } from '../annotations_srv';
import { PanelModel } from 'app/features/dashboard/state';
import { AnnotationQueryResponse } from '../types';

interface State {
  running?: boolean;
  response?: AnnotationQueryResponse;
}

export default class StandardAnnotationQueryEditor extends PureComponent<Props, State> {
  state = {} as State;

  componentDidMount() {
    this.verifyDataSource();
  }

  componentDidUpdate(oldProps: Props) {
    if (this.props.annotation !== oldProps.annotation) {
      this.verifyDataSource();
    }
  }

  verifyDataSource() {
    const { datasource, annotation } = this.props;

    // Handle any migration issues
    const processor = {
      ...standardAnnotationSupport,
      ...datasource.annotations,
    };

    const fixed = processor.prepareAnnotation!(annotation);
    if (fixed !== annotation) {
      this.props.change(fixed);
    } else {
      this.onRunQuery();
    }
  }

  onRunQuery = async () => {
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

  onQueryChange = (target: DataQuery) => {
    this.props.change({
      ...this.props.annotation,
      target,
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
    if (running || response?.panelData?.state === LoadingState.Loading) {
      return (
        <div>
          <Spinner />
          Loading...
        </div>
      );
    }
    const { events, panelData } = response!;

    if (panelData?.error) {
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
          {panelData.error.message}
        </div>
      );
    }
    if (events?.length) {
      return <div>No annottions found</div>;
    }
    return <div>Found: {events?.length} annotations</div>;
  }

  render() {
    const { datasource, annotation } = this.props;
    const { response } = this.state;

    // Find the annotaiton runner
    let QueryEditor = datasource.annotations?.QueryEditor || datasource.components?.QueryEditor;
    if (!QueryEditor) {
      return <div>Annotations are not supported. This datasource needs to export a QueryEditor</div>;
    }

    const query = annotation.target ?? { refId: 'Anno' };
    return (
      <>
        <QueryEditor
          key={datasource?.name}
          query={query}
          datasource={datasource}
          onChange={this.onQueryChange}
          onRunQuery={this.onRunQuery}
          data={response?.panelData}
          range={getTimeSrv().timeRange()}
        />
        {this.renderStatus()}
        [MAPPER]
        <br />
      </>
    );
    // const { response } = this.state;

    // const query = {
    //   rawQuery: true,
    //   ...annotation.query,
    // } as InfluxQuery;

    // return (
    //   <>
    //     <FluxQueryEditor target={query} change={this.onQueryChange} refresh={this.runQuery} />
    //     <br />
    //
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
