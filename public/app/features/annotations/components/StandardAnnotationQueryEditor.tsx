import { PureComponent, ReactElement } from 'react';
import { lastValueFrom } from 'rxjs';

import {
  AnnotationEventMappings,
  AnnotationQuery,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourcePluginContextProvider,
  LoadingState,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { DataQuery } from '@grafana/schema';
import { Alert, AlertVariant, Button, Space, Spinner } from '@grafana/ui';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';

import { executeAnnotationQuery } from '../executeAnnotationQuery';
import { shouldUseLegacyRunner, shouldUseMappingUI, standardAnnotationSupport } from '../standardAnnotationSupport';
import { AnnotationQueryResponse } from '../types';
import { updateAnnotationFromSavedQuery } from '../utils/savedQueryUtils';

import { AnnotationQueryEditorActionsWrapper } from './AnnotationQueryEditorActionsWrapper';
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
    // if dealing with v2 dashboards
    if (this.props.annotation.query && this.props.annotation.query.spec) {
      target = {
        ...this.props.annotation.query.spec,
        ...target,
      };
    }
    //target property is what ds query editor are using, but for v2 we also need to keep query in sync
    this.props.onChange({
      ...this.props.annotation,
      // the query editor uses target, but the annotation in v2 uses query
      // therefore we need to keep the target and query in sync
      target,
      ...(this.props.annotation.query && {
        query: {
          kind: this.props.annotation.query.kind,
          spec: { ...target },
        },
      }),
      // Keep legacyOptions from the original annotation if they exist
      ...(this.props.annotation.legacyOptions ? { legacyOptions: this.props.annotation.legacyOptions } : {}),
    });
  };

  onMappingChange = (mappings?: AnnotationEventMappings) => {
    this.props.onChange({
      ...this.props.annotation,
      mappings,
    });
  };

  getStatusSeverity(response: AnnotationQueryResponse): AlertVariant {
    const { events, panelData } = response;

    if (panelData?.errors || panelData?.error) {
      return 'error';
    }

    if (!events?.length) {
      return 'warning';
    }

    return 'success';
  }

  renderStatusText(response: AnnotationQueryResponse, running: boolean | undefined): ReactElement {
    const { events, panelData } = response;

    if (running || response?.panelData?.state === LoadingState.Loading || !response) {
      return <p>{'loading...'}</p>;
    }

    if (panelData?.errors) {
      return (
        <>
          {panelData.errors.map((e, i) => (
            <p key={i}>{e.message}</p>
          ))}
        </>
      );
    }
    if (panelData?.error) {
      return <p>{panelData.error.message ?? 'There was an error fetching data'}</p>;
    }

    if (!events?.length) {
      return (
        <p>
          <Trans i18nKey="annotations.standard-annotation-query-editor.no-events-found">No events found</Trans>
        </p>
      );
    }

    const frame = panelData?.series?.[0] ?? panelData?.annotations?.[0];
    const numEvents = events.length;
    const numFields = frame?.fields.length;
    return (
      <p>
        <Trans i18nKey="annotations.standard-annotation-query-editor.events-found">
          {{ numEvents }} events (from {{ numFields }} fields)
        </Trans>
      </p>
    );
  }

  renderStatus() {
    const { response, running } = this.state;

    if (!response) {
      return null;
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
              <Trans i18nKey="annotations.standard-annotation-query-editor.test-annotation-query">
                Test annotation query
              </Trans>
            </Button>
          )}
        </div>
        <Space v={2} layout="block" />
        <Alert
          data-testid={selectors.components.Annotations.editor.resultContainer}
          severity={this.getStatusSeverity(response)}
          title={t('annotations.standard-annotation-query-editor.title-query-result', 'Query result')}
        >
          {this.renderStatusText(response, running)}
        </Alert>
      </>
    );
  }

  onAnnotationChange = (annotation: AnnotationQuery) => {
    // Also preserve any legacyOptions field that might exist when migrating from V2 to V1
    this.props.onChange({
      ...annotation,
      // Keep legacyOptions from the original annotation if they exist
      ...(this.props.annotation.legacyOptions ? { legacyOptions: this.props.annotation.legacyOptions } : {}),
    });
  };

  onQueryReplace = (replacedQuery: DataQuery) => {
    const { annotation, onChange } = this.props;
    // Handle cross-datasource replacement
    const updatedAnnotation = updateAnnotationFromSavedQuery(annotation, replacedQuery);
    onChange(updatedAnnotation);
  };

  render() {
    const { datasource, annotation, datasourceInstanceSettings } = this.props;
    const { response } = this.state;

    // Find the annotation runner
    let QueryEditor = datasource.annotations?.QueryEditor || datasource.components?.QueryEditor;
    if (!QueryEditor) {
      return (
        <div>
          <Trans i18nKey="annotations.standard-annotation-query-editor.no-query-editor">
            Annotations are not supported. This datasource needs to export a QueryEditor
          </Trans>
        </div>
      );
    }

    // For v2 dashboards, target is not available, only query
    let target = annotation.target;

    // For v2 dashboards, use query.spec
    if (annotation.query && annotation.query.spec) {
      target = {
        ...annotation.query.spec,
      };
    }

    let query = {
      ...datasource.annotations?.getDefaultQuery?.(),
      ...(target ?? { refId: 'Anno' }),
    };

    // Create annotation object that respects annotations API
    let editorAnnotation = annotation;

    // For v2 dashboards: propagate legacyOptions to root level for datasource compatibility
    if (annotation.query && annotation.legacyOptions) {
      editorAnnotation = { ...annotation.legacyOptions, ...annotation };
    }

    return (
      <>
        <DataSourcePluginContextProvider instanceSettings={datasourceInstanceSettings}>
          <AnnotationQueryEditorActionsWrapper
            annotation={annotation}
            datasource={datasource}
            datasourceInstanceSettings={datasourceInstanceSettings}
            onQueryReplace={this.onQueryReplace}
          >
            <QueryEditor
              key={datasource?.name}
              query={query}
              datasource={datasource}
              onChange={this.onQueryChange}
              onRunQuery={this.onRunQuery}
              data={response?.panelData}
              range={getTimeSrv().timeRange()}
              annotation={editorAnnotation}
              onAnnotationChange={this.onAnnotationChange}
            />
          </AnnotationQueryEditorActionsWrapper>
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
