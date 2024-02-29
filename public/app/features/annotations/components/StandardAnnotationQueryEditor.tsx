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
import { selectors } from '@grafana/e2e-selectors';
import { Alert, AlertVariant, Button, Space, Spinner } from '@grafana/ui';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { PanelModel } from 'app/features/dashboard/state';

import { executeAnnotationQuery } from '../executeAnnotationQuery';
import { shouldUseLegacyRunner, shouldUseMappingUI, standardAnnotationSupport } from '../standardAnnotationSupport';
import { AnnotationQueryResponse } from '../types';

import { AnnotationFieldMapper } from './AnnotationResultMapper';

export interface Props {
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
    let text = '';
    let severity: AlertVariant = 'info';

    if (running || response?.panelData?.state === LoadingState.Loading || !response) {
      text = 'loading...';
    } else {
      const { events, panelData } = response;

      if (panelData?.errors) {
        severity = 'error';
        text = panelData.errors?.map((e) => e.message).join('. ') ?? 'There was an error fetching data';
      } else if (panelData?.error) {
        severity = 'error';
        text = panelData.error.message ?? 'There was an error fetching data';
      } else if (!events?.length) {
        severity = 'warning';
        text = 'No events found';
      } else {
        const frame = panelData?.series?.[0] ?? panelData?.annotations?.[0];
        text = `${events.length} events (from ${frame?.fields.length} fields)`;
      }
    }
    return (
      <>
        <Space v={2} />
        <div>
          {running ? (
            <Spinner />
          ) : (
            <Button
              data-testid={selectors.components.Annotations.editor.testButton}
              variant="secondary"
              size="xs"
              onClick={this.onRunQuery}
            >
              Test annotation query
            </Button>
          )}
        </div>
        <Space v={2} layout="block" />
        <Alert
          data-testid={selectors.components.Annotations.editor.resultContainer}
          severity={severity}
          title="Query result"
        >
          {text}
        </Alert>
      </>
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

    const query = {
      ...datasource.annotations?.getDefaultQuery?.(),
      ...(annotation.target ?? { refId: 'Anno' }),
    };

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
