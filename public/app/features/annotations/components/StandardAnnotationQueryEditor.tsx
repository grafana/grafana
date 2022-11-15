import { css, cx } from '@emotion/css';
import React, { PureComponent } from 'react';
import { lastValueFrom } from 'rxjs';

import {
  AnnotationEventMappings,
  AnnotationQuery,
  DataQuery,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourcePluginContextProvider,
  LoadingState,
} from '@grafana/data';
import { Button, Icon, IconName, Spinner } from '@grafana/ui';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { PanelModel } from 'app/features/dashboard/state';

import { executeAnnotationQuery } from '../executeAnnotationQuery';
import { shouldUseLegacyRunner, shouldUseMappingUI, standardAnnotationSupport } from '../standardAnnotationSupport';
import { AnnotationQueryResponse } from '../types';

import { AnnotationFieldMapper } from './AnnotationResultMapper';

interface Props {
  datasource: DataSourceApi;
  datasourceInstanceSettings: DataSourceInstanceSettings;
  annotation: AnnotationQuery<DataQuery>;
  onChange: (annotation: AnnotationQuery<DataQuery>) => void;
}

interface State {
  running?: boolean;
  response?: AnnotationQueryResponse;
}

export default class StandardAnnotationQueryEditor extends PureComponent<Props, State> {
  state: State = {};

  componentDidMount() {
    this.verifyDataSource();
  }

  componentDidUpdate(oldProps: Props) {
    if (this.props.annotation !== oldProps.annotation && !shouldUseLegacyRunner(this.props.datasource)) {
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
      this.props.onChange(fixed);
    } else {
      this.onRunQuery();
    }
  }

  onRunQuery = async () => {
    const { datasource, annotation } = this.props;
    if (shouldUseLegacyRunner(datasource)) {
      // In the new UI the running of query is done so the data can be mapped. In the legacy annotations this does
      // not exist as the annotationQuery already returns annotation events which cannot be mapped. This means that
      // right now running a query for data source with legacy runner does not make much sense.
      return;
    }

    const dashboard = getDashboardSrv().getCurrent();
    if (!dashboard) {
      return;
    }

    this.setState({
      running: true,
    });
    const response = await lastValueFrom(
      executeAnnotationQuery(
        {
          range: getTimeSrv().timeRange(),
          panel: new PanelModel({}),
          dashboard,
        },
        datasource,
        annotation
      )
    );
    this.setState({
      running: false,
      response,
    });
  };

  onQueryChange = (target: DataQuery) => {
    this.props.onChange({
      ...this.props.annotation,
      target,
    });
  };

  onMappingChange = (mappings?: AnnotationEventMappings) => {
    this.props.onChange({
      ...this.props.annotation,
      mappings,
    });
  };

  renderStatus() {
    const { response, running } = this.state;
    let rowStyle = 'alert-info';
    let text = '...';
    let icon: IconName | undefined = undefined;

    if (running || response?.panelData?.state === LoadingState.Loading || !response) {
      text = 'loading...';
    } else {
      const { events, panelData } = response;

      if (panelData?.error) {
        rowStyle = 'alert-error';
        icon = 'exclamation-triangle';
        text = panelData.error.message ?? 'error';
      } else if (!events?.length) {
        rowStyle = 'alert-warning';
        icon = 'exclamation-triangle';
        text = 'No events found';
      } else {
        const frame = panelData?.series[0];

        text = `${events.length} events (from ${frame?.fields.length} fields)`;
      }
    }
    return (
      <div
        className={cx(
          rowStyle,
          css`
            margin: 4px 0px;
            padding: 4px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          `
        )}
      >
        <div>
          {icon && (
            <>
              <Icon name={icon} />
              &nbsp;
            </>
          )}
          {text}
        </div>
        <div>
          {running ? (
            <Spinner />
          ) : (
            <Button variant="secondary" size="xs" onClick={this.onRunQuery}>
              TEST
            </Button>
          )}
        </div>
      </div>
    );
  }

  onAnnotationChange = (annotation: AnnotationQuery) => {
    this.props.onChange(annotation);
  };

  render() {
    const { datasource, annotation, datasourceInstanceSettings } = this.props;
    const { response } = this.state;

    // Find the annotation runner
    let QueryEditor = datasource.annotations?.QueryEditor || datasource.components?.QueryEditor;
    if (!QueryEditor) {
      return <div>Annotations are not supported. This datasource needs to export a QueryEditor</div>;
    }

    const query = annotation.target ?? { refId: 'Anno' };
    return (
      <>
        <DataSourcePluginContextProvider instanceSettings={datasourceInstanceSettings}>
          <QueryEditor
            key={datasource?.name}
            query={query}
            datasource={datasource}
            onChange={this.onQueryChange}
            onRunQuery={this.onRunQuery}
            data={response?.panelData}
            range={getTimeSrv().timeRange()}
            annotation={annotation}
            onAnnotationChange={this.onAnnotationChange}
          />
        </DataSourcePluginContextProvider>
        {shouldUseMappingUI(datasource) && (
          <>
            {this.renderStatus()}
            <AnnotationFieldMapper response={response} mappings={annotation.mappings} change={this.onMappingChange} />
          </>
        )}
      </>
    );
  }
}
