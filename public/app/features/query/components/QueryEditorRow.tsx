import classNames from 'clsx';
import { cloneDeep, filter, isEqual, uniqBy, uniqueId } from 'lodash';
import pluralize from 'pluralize';
import { memo, type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  CoreApp,
  type DataSourceApi,
  type DataSourceInstanceSettings,
  DataSourcePluginContextProvider,
  type PluginExtensionQueryEditorRowAdaptiveTelemetryV1Context,
  type EventBusExtended,
  type HistoryItem,
  LoadingState,
  type PanelData,
  type QueryResultMetaNotice,
  type ScopedVars,
  type TimeRange,
  getDataSourceRef,
  PluginExtensionPoints,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import {
  renderLimitedComponents,
  reportInteraction,
  usePluginComponents,
  getDataSourceInstance,
  getDataSourceInstanceSettings,
} from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';
import { Badge, ErrorBoundaryAlert, List } from '@grafana/ui';
import { OperationRowHelp } from 'app/core/components/QueryOperationRow/OperationRowHelp';
import {
  QueryOperationAction,
  QueryOperationToggleAction,
} from 'app/core/components/QueryOperationRow/QueryOperationAction';
import {
  QueryOperationRow,
  type QueryOperationRowRenderProps,
} from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { QueryEditorType } from 'app/features/dashboard-scene/panel-edit/PanelEditNext/constants';
import { isPanelEditorApp, trackCardAction } from 'app/features/dashboard-scene/panel-edit/PanelEditNext/tracking';

import { useQueryLibraryContext } from '../../explore/QueryLibrary/QueryLibraryContext';
import { type OnSelectQueriesType } from '../../explore/QueryLibrary/types';
import {
  type InternalQueryEditorInsertionPropsV1,
  type QueryEditorInsertionRegistrationV1,
} from '../../explore/SignalExplorer/internalInsertionContract';
import { isPrometheusType } from '../../explore/utils/prometheus';
import { ExpressionDatasourceUID } from '../../expressions/types';

import { type QueryActionComponent, RowActionComponents } from './QueryActionComponent';
import { QueryEditorRowExtensionActions } from './QueryEditorRowExtensionActions';
import { QueryEditorRowHeader } from './QueryEditorRowHeader';
import { QueryErrorAlert } from './QueryErrorAlert';
import { QueryLibraryEditingContainer } from './QueryLibraryEditingContainer';
import { pinScrollIntoView } from './pinScrollIntoView';
import { getQueryDataSourceIdentity } from './queryDataSourceIdentity';

export interface Props<TQuery extends DataQuery> {
  data: PanelData;
  query: TQuery;
  queries: TQuery[];
  id: string;
  index: number;
  dataSource: DataSourceInstanceSettings;
  onChangeDataSource?: (dsSettings: DataSourceInstanceSettings) => void;
  onDataSourceLoaded?: (instance: DataSourceApi) => void;
  renderHeaderExtras?: () => ReactNode;
  onAddQuery: (query: TQuery) => void;
  onRemoveQuery: (query: TQuery) => void;
  onChange: (query: TQuery) => void;
  onReplace?: (query: DataQuery) => void;
  onReplaceQueries?: (queries: DataQuery[]) => void;
  onRunQuery: () => void;
  visualization?: ReactNode;
  hideHideQueryButton?: boolean;
  app?: CoreApp;
  range: TimeRange;
  history?: Array<HistoryItem<TQuery>>;
  eventBus?: EventBusExtended;
  hideActionButtons?: boolean;
  draggable?: boolean;
  onQueryCopied?: () => void;
  onQueryRemoved?: () => void;
  onQueryToggled?: (queryStatus?: boolean | undefined) => void;
  onQueryOpenChanged?: (status?: boolean | undefined) => void;
  onQueryClosed?: () => void;
  /** Called when the data source's query editor changes the query. Header renames and hide toggles don't call it. */
  onQueryEdited?: () => void;
  onQueryReplacedFromLibrary?: () => void;
  collapsable?: boolean;
  hideRefId?: boolean;
  editSavedQueryRef?: string;
  onExitQueryLibraryEdit?: () => void;
  addingSavedQuery?: boolean;
  onCancelAddSavedQuery?: () => void;
  isOpen?: boolean;
  /**
   * Required to resolve section-scoped (row/tab) datasource variables
   */
  scopedVars?: ScopedVars;
  /**
   * When true, scrolls the row into view once it first renders.
   */
  scrollIntoView?: boolean;
  /** Called after the scroll happens so the owner can clear the flag. */
  onScrollIntoView?: () => void;
  /** Handed only to Prometheus editors, the one datasource that implements it. */
  queryEditorInsertion?: QueryEditorInsertionRegistrationV1;
}

/**
 * When datasource variables are used the query.datasource.uid property is a string variable expression.
 * Resolves it to the current instance, falling back to the default datasource if it doesn't exist.
 */
async function loadQueryDataSource(
  queryDataSource: DataQuery['datasource'],
  scopedVars: ScopedVars | undefined,
  dataSource: DataSourceInstanceSettings
): Promise<DataSourceApi> {
  const settings = queryDataSource ? await getDataSourceInstanceSettings(queryDataSource, scopedVars) : dataSource;
  const interpolatedUID = settings?.rawRef?.uid ?? settings?.uid;

  try {
    return await getDataSourceInstance(interpolatedUID);
  } catch {
    // Getting with no args returns the default DS.
    return await getDataSourceInstance();
  }
}

function QueryEditorRowComponent<TQuery extends DataQuery>(props: Props<TQuery>) {
  const {
    data,
    query,
    queries,
    id,
    index,
    dataSource,
    onChangeDataSource,
    renderHeaderExtras,
    onAddQuery,
    onRemoveQuery,
    onChange,
    onReplace,
    onReplaceQueries,
    onRunQuery,
    visualization,
    hideHideQueryButton = false,
    app,
    range,
    history,
    hideActionButtons,
    draggable = true,
    onQueryCopied,
    onQueryRemoved,
    onQueryToggled,
    onQueryOpenChanged,
    onQueryClosed,
    onQueryReplacedFromLibrary,
    collapsable,
    hideRefId,
    editSavedQueryRef,
    onExitQueryLibraryEdit,
    addingSavedQuery,
    onCancelAddSavedQuery,
    isOpen,
    scopedVars,
    scrollIntoView,
    queryEditorInsertion,
  } = props;

  // A non-empty Draggable id from the first paint, before the datasource instance loads. Fixed for the
  // row's lifetime: callers key rows by the same refId they pass as `id`, so a rename remounts the row.
  const [rowId] = useState(() => uniqueId(id + '_'));
  const editorRef = useRef<HTMLDivElement>(null);
  const cancelScrollPinRef = useRef<(() => void) | undefined>(undefined);
  const [showingHelp, setShowingHelp] = useState(false);
  /** The loaded instance and the datasource identity it was loaded for. */
  const [loaded, setLoaded] = useState<{ datasource: DataSourceApi<TQuery>; identifier?: string } | null>(null);
  const datasource = loaded?.datasource ?? null;
  const filteredData = useMemo(() => filterPanelDataToQuery(data, query.refId), [data, query.refId]);

  // Read by the stable `onEditorChange`, the datasource load and the scroll pin callbacks
  const propsRef = useRef(props);
  useLayoutEffect(() => {
    propsRef.current = props;
  });

  // Sync identity for the datasource this row should show. Computed during render so a datasource
  // (or variable) change hides the plugin editor on this paint, not after the async load.
  const identifier = getQueryDataSourceIdentity(query.datasource, scopedVars, dataSource);
  const isWaitingForDatasourceToLoad = !loaded || loaded.identifier !== identifier;

  useEffect(() => {
    let cancelled = false;
    const { query, scopedVars, dataSource } = propsRef.current;

    loadQueryDataSource(query.datasource, scopedVars, dataSource).then(
      (instance) => {
        if (cancelled) {
          return;
        }
        propsRef.current.onDataSourceLoaded?.(instance);
        setLoaded({ datasource: instance as unknown as DataSourceApi<TQuery>, identifier });
      },
      () => {
        // Both lookups failed. Keep the previous instance; the identity mismatch hides its editor.
      }
    );

    return () => {
      cancelled = true;
    };
  }, [identifier]);

  // Order of useLayoutEffects is important: on unmount React runs cleanups in order, so this one sees a pin
  // still in flight before the pin effect below cancels it. A cancelled pin never reaches onDone, so report
  // here or the owner's one-shot flag stays set (e.g. switching tabs mid-pin, or deleting the pinned row).
  useLayoutEffect(
    () => () => {
      if (cancelScrollPinRef.current) {
        cancelScrollPinRef.current();
        cancelScrollPinRef.current = undefined;
        propsRef.current.onScrollIntoView?.();
      }
    },
    []
  );

  // `editorRef` only attaches once the datasource has loaded, hence `hasDatasource`.
  const hasDatasource = loaded !== null;
  useLayoutEffect(() => {
    if (!scrollIntoView || !editorRef.current) {
      return;
    }
    // A single scroll is not enough: the other rows' editors load asynchronously and push this
    // row away as they grow, so keep it pinned until the layout settles or the user scrolls.
    cancelScrollPinRef.current = pinScrollIntoView(editorRef.current, () => {
      cancelScrollPinRef.current = undefined;
      propsRef.current.onScrollIntoView?.();
    });

    // The owner retargeted the scroll (e.g. a second expression added before this pin settled).
    // Cancel rather than finish, since finishing would report back and clear the owner's new target.
    return () => {
      cancelScrollPinRef.current?.();
      cancelScrollPinRef.current = undefined;
    };
  }, [scrollIntoView, hasDatasource]);

  // Editors may hold on to the onChange they got on mount (e.g. a Monaco listener), and the parent's
  // onChange is recreated each render over that render's queries. Stay stable and forward to the latest.
  const onEditorChange = useCallback((next: TQuery) => {
    const { query, onChange, onQueryEdited } = propsRef.current;
    if (!isEqual(next, query)) {
      onQueryEdited?.();
    }
    onChange(next);
  }, []);

  const isExpressionQuery = query.datasource?.uid === ExpressionDatasourceUID;
  const trackAction = (action: 'delete' | 'toggle_hide' | 'duplicate') =>
    trackCardAction(action, isExpressionQuery ? QueryEditorType.Expression : QueryEditorType.Query, 'content_header', {
      editor: 'classic',
      silent: !isPanelEditorApp(app),
    });

  const onRemove = () => {
    if (isExpressionQuery && 'type' in query && query.type) {
      reportInteraction('dashboards_expression_interaction', {
        action: 'remove_expression',
        expression_type: query.type,
        context: 'panel_query_section',
      });
    }
    trackAction('delete');
    onRemoveQuery(query);
    onQueryRemoved?.();
  };

  const onSavedQueryModeSuccess = () => {
    if (addingSavedQuery) {
      onCancelAddSavedQuery?.();
      return;
    }
    onExitQueryLibraryEdit?.();
  };

  const onCopyQuery = () => {
    trackAction('duplicate');
    onAddQuery(cloneDeep(query));
    onQueryCopied?.();
  };

  const onHideQuery = () => {
    trackAction('toggle_hide');
    onChange({ ...query, hide: !query.hide });
    onRunQuery();
    onQueryToggled?.(query.hide);
  };

  const onToggleHelp = () => setShowingHelp((showing) => !showing);

  const onClickExample = (example: TQuery) => {
    if (example.datasource === undefined) {
      example.datasource = getDataSourceRef(dataSource);
    }
    onChange({ ...example, refId: query.refId });
    onToggleHelp();
  };

  const onSelectQueryFromLibrary = (selected: DataQuery) => {
    onQueryReplacedFromLibrary?.();
    onReplace?.(selected);
  };

  const onSelectQueriesFromLibrary = (selected: DataQuery[]) => {
    onQueryReplacedFromLibrary?.();
    onReplaceQueries?.(selected);
  };

  if (!datasource) {
    return null;
  }

  const renderPluginEditor = () => {
    if (isWaitingForDatasourceToLoad) {
      return null;
    }

    const QueryEditor =
      app === CoreApp.Explore
        ? datasource.components?.ExploreMetricsQueryField ||
          datasource.components?.ExploreLogsQueryField ||
          datasource.components?.ExploreQueryField ||
          datasource.components?.QueryEditor
        : datasource.components?.QueryEditor;

    if (!QueryEditor) {
      return (
        <div>
          <Trans i18nKey="query-operation.query-editor-not-exported">
            Data source plugin does not export any Query Editor component
          </Trans>
        </div>
      );
    }

    const internalInsertionProps: InternalQueryEditorInsertionPropsV1 = {
      unstable_queryEditorInsertionV1: isPrometheusType(datasource.type) ? queryEditorInsertion : undefined,
    };

    return (
      <DataSourcePluginContextProvider instanceSettings={dataSource}>
        <QueryEditor
          key={datasource.name}
          {...internalInsertionProps}
          query={query}
          datasource={datasource}
          onChange={onEditorChange}
          onRunQuery={onRunQuery}
          onAddQuery={onAddQuery}
          data={filteredData}
          range={range}
          queries={queries}
          app={app ?? CoreApp.PanelEditor}
          history={history}
        />
      </DataSourcePluginContextProvider>
    );
  };

  const renderCollapsedText = (): string | null => {
    if (typeof datasource.getQueryDisplayText !== 'function') {
      return null;
    }

    try {
      return datasource.getQueryDisplayText(query);
    } catch (error) {
      // Some datasource plugins may throw errors in getQueryDisplayText
      // Return null gracefully to prevent the query editor from crashing.
      return null;
    }
  };

  const renderWarnings = (type: 'info' | 'warning') => {
    const allWarnings = (filteredData?.series ?? []).reduce((acc: QueryResultMetaNotice[], serie) => {
      if (!serie.meta?.notices) {
        return acc;
      }
      return acc.concat(filter(serie.meta.notices, (item: QueryResultMetaNotice) => item.severity === type));
    }, []);

    const uniqueWarnings = uniqBy(allWarnings, 'text');
    if (uniqueWarnings.length === 0) {
      return null;
    }

    const listItems = uniqueWarnings.map((warning) => warning.text);

    return (
      <Badge
        key={'query-' + type + 's'}
        color={type === 'warning' ? 'orange' : 'blue'}
        icon={type === 'warning' ? 'exclamation-triangle' : 'file-landscape-alt'}
        text={
          <>
            {uniqueWarnings.length} {pluralize(type, uniqueWarnings.length)}
          </>
        }
        tooltip={<List items={listItems} renderItem={(item) => <>{item}</>} />}
      />
    );
  };

  const renderExtraActions = () => {
    const scopedActions: QueryActionComponent[] =
      app !== undefined ? RowActionComponents.getScopedExtraRenderAction(app) : [];

    const extraActions = [...RowActionComponents.getAllExtraRenderAction(), ...scopedActions]
      .map((action, index) =>
        action({
          query,
          queries,
          timeRange: data.timeRange,
          onAddQuery: onAddQuery as (query: DataQuery) => void,
          dataSource,
          key: index,
        })
      )
      .filter(Boolean);

    extraActions.push(renderWarnings('info'));
    extraActions.push(renderWarnings('warning'));
    extraActions.push(<AdaptiveTelemetryQueryActions key="adaptive-telemetry-actions" query={query} />);
    extraActions.push(
      <QueryEditorRowExtensionActions
        key="query-editor-row-extension-actions"
        query={query}
        queries={queries}
        dataSource={dataSource}
        app={app}
        timeRange={data.timeRange}
      />
    );

    return extraActions;
  };

  // Both saved-query flows (editing an existing one and adding a new one) hide the per-row
  // save/duplicate/remove actions, show the banner above the editor and wrap it in the highlighted container.
  const inSavedQueryMode = editSavedQueryRef !== undefined || !!addingSavedQuery;
  const isHidden = !!query.hide;

  const renderActions = () => (
    <>
      {!inSavedQueryMode && app !== CoreApp.UnifiedAlerting && !isExpressionQuery && (
        <SavedQueryButtons
          query={{ ...query, datasource: { uid: datasource.uid, type: datasource.type } }}
          app={app}
          onUpdateSuccess={onExitQueryLibraryEdit}
          onSelectQuery={onSelectQueryFromLibrary}
          onSelectQueries={onSelectQueriesFromLibrary}
          datasourceFilters={datasource.name ? [datasource.name] : []}
          parentRef={editorRef}
        />
      )}

      {datasource.components?.QueryEditorHelp && (
        <QueryOperationToggleAction
          title={t('query-operation.header.datasource-help', 'Show data source help')}
          icon="question-circle"
          onClick={onToggleHelp}
          active={showingHelp}
        />
      )}
      {renderExtraActions()}
      {!inSavedQueryMode && (
        <QueryOperationAction
          title={t('query-operation.header.duplicate-query', 'Duplicate query')}
          // Set explicitly so the test id stays stable across locales: QueryOperationAction
          // otherwise derives it from the translated title.
          dataTestId={selectors.components.QueryEditorRow.actionButton('Duplicate query')}
          icon="copy"
          onClick={onCopyQuery}
        />
      )}

      {!hideHideQueryButton ? (
        <QueryOperationToggleAction
          dataTestId={selectors.components.QueryEditorRow.actionButton('Hide response')}
          title={
            query.hide
              ? t('query-operation.header.show-response', 'Show response')
              : t('query-operation.header.hide-response', 'Hide response')
          }
          icon={isHidden ? 'eye-slash' : 'eye'}
          active={isHidden}
          onClick={onHideQuery}
        />
      ) : null}
      {!inSavedQueryMode && (
        <QueryOperationAction
          title={t('query-operation.header.remove-query', 'Remove query')}
          icon="trash-alt"
          onClick={onRemove}
        />
      )}
    </>
  );

  const renderHeader = (rowProps: QueryOperationRowRenderProps) => (
    <QueryEditorRowHeader
      query={query}
      queries={queries}
      onChangeDataSource={onChangeDataSource}
      dataSource={dataSource}
      hidden={query.hide}
      onChange={onChange}
      collapsedText={!rowProps.isOpen ? renderCollapsedText() : null}
      renderExtras={() => <>{renderHeaderExtras && renderHeaderExtras()}</>}
      alerting={app === CoreApp.UnifiedAlerting}
      hideRefId={hideRefId}
    />
  );

  const error =
    filteredData?.error && filteredData.error.refId === query.refId
      ? filteredData.error
      : filteredData?.errors?.find((e) => e.refId === query.refId);
  const rowClasses = classNames('query-editor-row', {
    'query-editor-row--disabled': isHidden,
    'gf-form-disabled': isHidden,
  });
  const DatasourceCheatsheet = datasource.components?.QueryEditorHelp;
  const pluginId = datasource.type;

  const queryOperationRow = (
    <QueryOperationRow
      id={rowId}
      draggable={draggable && !hideActionButtons && !inSavedQueryMode}
      collapsable={collapsable}
      index={index}
      headerElement={renderHeader}
      actions={hideActionButtons ? undefined : renderActions}
      isOpen={isOpen}
      onOpen={onQueryOpenChanged}
      onClose={onQueryClosed}
    >
      <div
        className={rowClasses}
        id={rowId}
        data-testid={selectors.components.Plugins.queryEditorRow(pluginId, query.refId)}
        data-plugin-id={pluginId}
      >
        <ErrorBoundaryAlert boundaryName="query-editor-operation-row">
          {showingHelp && DatasourceCheatsheet && (
            <OperationRowHelp>
              <DatasourceCheatsheet onClickExample={onClickExample} query={query} datasource={datasource} />
            </OperationRowHelp>
          )}
          {renderPluginEditor()}
        </ErrorBoundaryAlert>
        {error && <QueryErrorAlert error={error} query={query} />}
        {visualization}
      </div>
    </QueryOperationRow>
  );

  return (
    <div data-testid={selectors.components.QueryEditorRows.rows} ref={editorRef}>
      {inSavedQueryMode && (
        <MaybeQueryLibraryEditingHeader
          query={query}
          app={app}
          editSavedQueryRef={editSavedQueryRef}
          mode={addingSavedQuery ? 'add' : 'edit'}
          onCancelEdit={addingSavedQuery ? onCancelAddSavedQuery : onExitQueryLibraryEdit}
          onUpdateSuccess={onSavedQueryModeSuccess}
          onSelectQuery={onSelectQueryFromLibrary}
        />
      )}
      {inSavedQueryMode ? (
        <QueryLibraryEditingContainer>{queryOperationRow}</QueryLibraryEditingContainer>
      ) : (
        queryOperationRow
      )}
    </div>
  );
}

// needed to properly forward the generic type through React.memo
// see https://github.com/DefinitelyTyped/DefinitelyTyped/issues/37087#issuecomment-656596623
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export const QueryEditorRow = memo(QueryEditorRowComponent) as typeof QueryEditorRowComponent;
/**
 * Get a version of the PanelData limited to the query we are looking at
 */
export function filterPanelDataToQuery(data: PanelData, refId: string): PanelData | undefined {
  const series = data.series.filter((series) => series.refId === refId);

  // If there was an error with no data and the panel is not in a loading state, pass it to the QueryEditors
  if (data.state !== LoadingState.Loading && (data.error || data.errors?.length) && !data.series.length) {
    return {
      ...data,
      state: LoadingState.Error,
    };
  }

  // Only say this is an error if the error links to the query
  let state = data.state;
  let error = data.errors?.find((e) => e.refId === refId);
  if (!error && data.error) {
    error = data.error.refId === refId ? data.error : undefined;
  }

  if (state !== LoadingState.Loading) {
    if (error) {
      state = LoadingState.Error;
    } else if (data.state === LoadingState.Error) {
      state = LoadingState.Done;
    }
  }

  const timeRange = data.timeRange;

  return {
    ...data,
    state,
    series,
    error,
    errors: error ? [error] : undefined,
    timeRange,
  };
}

// Will render anything only if saved query is enabled
function SavedQueryButtons(props: {
  query: DataQuery;
  app?: CoreApp;
  onUpdateSuccess?: () => void;
  onSelectQuery: (query: DataQuery) => void;
  onSelectQueries?: OnSelectQueriesType;
  datasourceFilters: string[];
  parentRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { renderSavedQueryButtons } = useQueryLibraryContext();
  return renderSavedQueryButtons({
    query: props.query,
    app: props.app,
    onUpdateSuccess: props.onUpdateSuccess,
    onSelectQuery: props.onSelectQuery,
    parentRef: props.parentRef,
    onSelectQueries: props.onSelectQueries,
  });
}

// Will render editing header only if query library is enabled
function MaybeQueryLibraryEditingHeader(props: {
  query: DataQuery;
  app?: CoreApp;
  editSavedQueryRef?: string;
  mode?: 'edit' | 'add';
  onCancelEdit?: () => void;
  onUpdateSuccess?: () => void;
  onSelectQuery?: (query: DataQuery) => void;
}) {
  const { renderQueryLibraryEditingHeader } = useQueryLibraryContext();
  return renderQueryLibraryEditingHeader(
    props.query,
    props.app,
    props.editSavedQueryRef,
    props.onCancelEdit,
    props.onUpdateSuccess,
    props.onSelectQuery,
    props.mode
  );
}

function AdaptiveTelemetryQueryActions({ query }: { query: DataQuery }) {
  const { isLoading, components } = usePluginComponents<PluginExtensionQueryEditorRowAdaptiveTelemetryV1Context>({
    extensionPointId: PluginExtensionPoints.QueryEditorRowAdaptiveTelemetryV1,
  });

  if (isLoading || !components.length) {
    return null;
  }

  return renderLimitedComponents({
    props: { query, contextHints: ['queryeditorrow', 'header'] },
    components,
    limit: 1,
    pluginId: /grafana-adaptive.*/,
  });
}
