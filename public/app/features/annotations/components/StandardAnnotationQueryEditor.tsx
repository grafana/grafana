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
    const { events, error } = response!;

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

  renderPluginEditor = () => {
    const { datasource, annotation } = this.props;

    // Find the annotaiton runner
    let QueryEditor = datasource.annotations?.QueryEditor || datasource.components?.QueryEditor;
    if (!QueryEditor) {
      return <div>Missing QueryEditor or Annotation Editor</div>;
    }

    const query = annotation.query ?? { refId: 'Anno' };
    return (
      <QueryEditor
        key={datasource?.name}
        query={query}
        datasource={datasource}
        onChange={this.onQueryChange}
        onRunQuery={this.onRunQuery}
        // data={data}
        range={getTimeSrv().timeRange()}
      />
    );
  };

  render() {
    // const { annotation } = this.props;

    // datasource: DSType;
    // query: TQuery;
    // onRunQuery: () => void;
    // onChange: (value: TQuery) => void;
    // onBlur?: () => void;
    // data?: PanelData;
    // range?: TimeRange;

    return (
      <div>
        <div>STANDARD/EDITOR</div>
        {this.renderPluginEditor()}
        <div>AFTER</div>
      </div>
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
