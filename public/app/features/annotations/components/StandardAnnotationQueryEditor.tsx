import { memo, useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { lastValueFrom } from 'rxjs';

import {
  type AnnotationEventMappings,
  type AnnotationQuery,
  type DataSourceApi,
  type DataSourceInstanceSettings,
  DataSourcePluginContextProvider,
  LoadingState,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { type DataQuery } from '@grafana/schema';
import { Alert, type AlertVariant, Button, Space, Spinner } from '@grafana/ui';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';

import { executeAnnotationQuery } from '../executeAnnotationQuery';
import { shouldUseLegacyRunner, shouldUseMappingUI, standardAnnotationSupport } from '../standardAnnotationSupport';
import { type AnnotationQueryResponse } from '../types';
import { updateAnnotationFromSavedQuery } from '../utils/savedQueryUtils';

import { AnnotationQueryEditorActionsWrapper } from './AnnotationQueryEditorActionsWrapper';
import { AnnotationFieldMapper } from './AnnotationResultMapper';

export interface Props {
  datasource: DataSourceApi;
  datasourceInstanceSettings: DataSourceInstanceSettings;
  annotation: AnnotationQuery<DataQuery>;
  onChange: (annotation: AnnotationQuery<DataQuery>) => void;
  disableSavedQueries?: boolean;
}

function getStatusSeverity(response: AnnotationQueryResponse): AlertVariant {
  const { events, panelData } = response;

  if (panelData?.errors || panelData?.error) {
    return 'error';
  }

  if (!events?.length) {
    return 'warning';
  }

  return 'success';
}

function renderStatusText(response: AnnotationQueryResponse, running: boolean | undefined): ReactElement {
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

export default memo(function StandardAnnotationQueryEditor({
  datasource,
  datasourceInstanceSettings,
  annotation,
  onChange,
  disableSavedQueries,
}: Props) {
  const [running, setRunning] = useState<boolean>(false);
  const [response, setResponse] = useState<AnnotationQueryResponse | undefined>(undefined);
  // Transient flag set after a saved query replacement to skip the next preparation; not rendered, so a ref.
  const skipNextVerificationRef = useRef(false);

  const onRunQuery = useCallback(async () => {
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

    setRunning(true);
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
    setRunning(false);
    setResponse(response);
  }, [datasource, annotation]);

  /**
   * verifyDataSource() prepares the annotation and provides immediate query feedback:
   * 1. Applies datasource-specific preparation (e.g., Prometheus moves expr to target field)
   * 2. Updates annotation if preparation made changes
   * 3. Runs query to show immediate results in the UI
   */
  const verifyDataSource = useCallback(() => {
    // Skip verification if we just did a saved query replacement to avoid double preparation
    if (skipNextVerificationRef.current) {
      skipNextVerificationRef.current = false;
      onRunQuery();
      return;
    }

    // Always run prepareAnnotation to ensure proper query structure
    // This is essential for datasources like Prometheus that need to format queries correctly
    const processor = {
      ...standardAnnotationSupport,
      ...datasource.annotations,
    };

    const fixed = processor.prepareAnnotation!(annotation);
    // if datasource prepared annotation returns a different annotation(e.g., prometheus before had expr in the root level now it's saved in 'target'), update the annotation with that one
    if (fixed !== annotation) {
      onChange(fixed);
    } else {
      onRunQuery();
    }
  }, [datasource, annotation, onChange, onRunQuery]);

  useEffect(() => {
    verifyDataSource();
  }, [verifyDataSource]);

  const onQueryChange = (target: DataQuery) => {
    // if dealing with v2 dashboards
    if (annotation.query && annotation.query.spec) {
      target = {
        ...annotation.query.spec,
        ...target,
      };
    }
    //target property is what ds query editor are using, but for v2 we also need to keep query in sync
    onChange({
      ...annotation,
      // the query editor uses target, but the annotation in v2 uses query
      // therefore we need to keep the target and query in sync
      target,
      ...(annotation.query && {
        query: {
          kind: annotation.query.kind,
          spec: { ...target },
        },
      }),
      // Keep legacyOptions from the original annotation if they exist
      ...(annotation.legacyOptions ? { legacyOptions: annotation.legacyOptions } : {}),
    });
  };

  const onMappingChange = (mappings?: AnnotationEventMappings) => {
    onChange({
      ...annotation,
      mappings,
    });
  };

  const onAnnotationChange = (newAnnotation: AnnotationQuery) => {
    // Also preserve any legacyOptions field that might exist when migrating from V2 to V1
    onChange({
      ...newAnnotation,
      // Keep legacyOptions from the original annotation if they exist
      ...(annotation.legacyOptions ? { legacyOptions: annotation.legacyOptions } : {}),
    });
  };

  const onQueryReplace = async (replacedQuery: DataQuery) => {
    try {
      // Use new async updateAnnotationFromSavedQuery that returns properly prepared annotation
      const preparedAnnotation = await updateAnnotationFromSavedQuery(annotation, replacedQuery);
      // Set flag to skip next verification since updateAnnotationFromSavedQuery already prepared the annotation
      skipNextVerificationRef.current = true;
      onChange(preparedAnnotation);
    } catch (error) {
      console.error('Failed to replace annotation query:', error);
      // On error, reset the replacing state but don't change the annotation
    }
  };

  const renderStatus = () => {
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
              onClick={onRunQuery}
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
          severity={getStatusSeverity(response)}
          title={t('annotations.standard-annotation-query-editor.title-query-result', 'Query result')}
        >
          {renderStatusText(response, running)}
        </Alert>
      </>
    );
  };

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
          disableSavedQueries={disableSavedQueries}
          annotation={annotation}
          datasource={datasource}
          onQueryReplace={onQueryReplace}
        >
          <QueryEditor
            key={datasource?.name}
            query={query}
            datasource={datasource}
            onChange={onQueryChange}
            onRunQuery={onRunQuery}
            data={response?.panelData}
            range={getTimeSrv().timeRange()}
            annotation={editorAnnotation}
            onAnnotationChange={onAnnotationChange}
          />
        </AnnotationQueryEditorActionsWrapper>
      </DataSourcePluginContextProvider>
      {shouldUseMappingUI(datasource) && (
        <>
          {renderStatus()}
          <AnnotationFieldMapper response={response} mappings={annotation.mappings} change={onMappingChange} />
        </>
      )}
    </>
  );
});
