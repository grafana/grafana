import classNames from 'classnames';
import { cloneDeep, filter, uniqBy, uniqueId } from 'lodash';
import pluralize from 'pluralize';
import { PureComponent, ReactNode } from 'react';

import {
  CoreApp,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourcePluginContextProvider,
  PluginExtensionQueryEditorRowAdaptiveTelemetryV1Context,
  EventBusExtended,
  HistoryItem,
  LoadingState,
  PanelData,
  QueryResultMetaNotice,
  TimeRange,
  getDataSourceRef,
  PluginExtensionPoints,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { getDataSourceSrv, renderLimitedComponents, reportInteraction, usePluginComponents } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Badge, Divider, ErrorBoundaryAlert, List } from '@grafana/ui';
import { OperationRowHelp } from 'app/core/components/QueryOperationRow/OperationRowHelp';
import {
  QueryOperationAction,
  QueryOperationToggleAction,
} from 'app/core/components/QueryOperationRow/QueryOperationAction';
import {
  QueryOperationRow,
  QueryOperationRowRenderProps,
} from 'app/core/components/QueryOperationRow/QueryOperationRow';

import { useQueryLibraryContext } from '../../explore/QueryLibrary/QueryLibraryContext';

import { QueryActionComponent, RowActionComponents } from './QueryActionComponent';
import { QueryEditorRowHeader } from './QueryEditorRowHeader';
import { QueryErrorAlert } from './QueryErrorAlert';

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
  onRunQuery: () => void;
  visualization?: ReactNode;
  hideHideQueryButton?: boolean;
  app?: CoreApp;
  range: TimeRange;
  history?: Array<HistoryItem<TQuery>>;
  eventBus?: EventBusExtended;
  hideActionButtons?: boolean;
  onQueryCopied?: () => void;
  onQueryRemoved?: () => void;
  onQueryToggled?: (queryStatus?: boolean | undefined) => void;
  onQueryOpenChanged?: (status?: boolean | undefined) => void;
  onQueryReplacedFromLibrary?: () => void;
  collapsable?: boolean;
  hideRefId?: boolean;
  queryLibraryRef?: string;
  onCancelQueryLibraryEdit?: () => void;
  isOpen?: boolean;
}

interface State<TQuery extends DataQuery> {
  /** DatasourceUid or ds variable expression used to resolve current datasource */
  queriedDataSourceIdentifier?: string | null;
  datasource: DataSourceApi<TQuery> | null;
  datasourceUid?: string | null;
  data?: PanelData;
  isOpen?: boolean;
  showingHelp: boolean;
}

export class QueryEditorRow<TQuery extends DataQuery> extends PureComponent<Props<TQuery>, State<TQuery>> {
  dataSourceSrv = getDataSourceSrv();
  id = '';

  state: State<TQuery> = {
    datasource: null,
    data: undefined,
    isOpen: true,
    showingHelp: false,
  };

  componentDidMount() {
    const { data, query, id } = this.props;
    const dataFilteredByRefId = filterPanelDataToQuery(data, query.refId);
    this.id = uniqueId(id + '_');
    this.setState({ data: dataFilteredByRefId });

    this.loadDatasource();
  }

  /**
   * When datasource variables are used the query.datasource.uid property is a string variable expression
   * DataSourceSettings.uid can also be this variable expression.
   * This function always returns the current interpolated datasource uid.
   */
  getInterpolatedDataSourceUID(): string | undefined {
    if (this.props.query.datasource) {
      const instanceSettings = this.dataSourceSrv.getInstanceSettings(this.props.query.datasource);
      return instanceSettings?.rawRef?.uid ?? instanceSettings?.uid;
    }

    return this.props.dataSource.rawRef?.uid ?? this.props.dataSource.uid;
  }

  async loadDatasource() {
    let datasource: DataSourceApi;
    const interpolatedUID = this.getInterpolatedDataSourceUID();

    try {
      datasource = await this.dataSourceSrv.get(interpolatedUID);
    } catch (error) {
      // If the DS doesn't exist, it fails. Getting with no args returns the default DS.
      datasource = await this.dataSourceSrv.get();
    }

    if (typeof this.props.onDataSourceLoaded === 'function') {
      this.props.onDataSourceLoaded(datasource);
    }

    this.setState({
      datasource: datasource as unknown as DataSourceApi<TQuery>,
      queriedDataSourceIdentifier: interpolatedUID,
    });
  }

  componentDidUpdate(prevProps: Props<TQuery>) {
    const { datasource, queriedDataSourceIdentifier } = this.state;
    const { data, query } = this.props;

    if (prevProps.id !== this.props.id) {
      this.id = uniqueId(this.props.id + '_');
    }

    if (data !== prevProps.data) {
      const dataFilteredByRefId = filterPanelDataToQuery(data, query.refId);

      this.setState({ data: dataFilteredByRefId });
    }

    // check if we need to load another datasource
    if (datasource && queriedDataSourceIdentifier !== this.getInterpolatedDataSourceUID()) {
      this.loadDatasource();
      return;
    }
  }

  getQueryEditor(ds: DataSourceApi<TQuery>) {
    if (!ds) {
      return;
    }

    switch (this.props.app) {
      case CoreApp.Explore:
        return (
          ds.components?.ExploreMetricsQueryField ||
          ds.components?.ExploreLogsQueryField ||
          ds.components?.ExploreQueryField ||
          ds.components?.QueryEditor
        );
      case CoreApp.PanelEditor:
      case CoreApp.Dashboard:
      default:
        return ds.components?.QueryEditor;
    }
  }

  isWaitingForDatasourceToLoad(): boolean {
    // if we not yet have loaded the datasource in state the
    // ds in props and the ds in state will have different values.
    return this.getInterpolatedDataSourceUID() !== this.state.queriedDataSourceIdentifier;
  }

  renderPluginEditor = () => {
    const { query, onChange, queries, onRunQuery, onAddQuery, range, app = CoreApp.PanelEditor, history } = this.props;
    const { datasource, data } = this.state;

    if (this.isWaitingForDatasourceToLoad()) {
      return null;
    }

    if (datasource) {
      let QueryEditor = this.getQueryEditor(datasource);

      if (QueryEditor) {
        return (
          <DataSourcePluginContextProvider instanceSettings={this.props.dataSource}>
            <QueryEditor
              key={datasource?.name}
              query={query}
              datasource={datasource}
              onChange={onChange}
              onRunQuery={onRunQuery}
              onAddQuery={onAddQuery}
              data={data}
              range={range}
              queries={queries}
              app={app}
              history={history}
            />
          </DataSourcePluginContextProvider>
        );
      }
    }

    return (
      <div>
        <Trans i18nKey="query-operation.query-editor-not-exported">
          Data source plugin does not export any Query Editor component
        </Trans>
      </div>
    );
  };

  onRemoveQuery = () => {
    const { onRemoveQuery, query, onQueryRemoved } = this.props;
    onRemoveQuery(query);

    if (onQueryRemoved) {
      onQueryRemoved();
    }
  };

  onCancelQueryLibraryEdit = () => {
    this.props.onCancelQueryLibraryEdit?.();
    // TODO add monitoring
    // TODO redirect to query editor
  };

  onExitQueryLibraryEditingMode = () => {
    // Exit query library editing mode after successful update
    this.props.onCancelQueryLibraryEdit?.();
  };

  onCopyQuery = () => {
    const { query, onAddQuery, onQueryCopied } = this.props;
    const copy = cloneDeep(query);
    onAddQuery(copy);

    if (onQueryCopied) {
      onQueryCopied();
    }
  };

  onHideQuery = () => {
    const { query, onChange, onRunQuery, onQueryToggled } = this.props;
    onChange({ ...query, hide: !query.hide });
    onRunQuery();

    if (onQueryToggled) {
      onQueryToggled(query.hide);
    }

    reportInteraction('query_editor_row_hide_query_clicked', {
      hide: !query.hide,
    });
  };

  onToggleHelp = () => {
    this.setState((state) => ({
      showingHelp: !state.showingHelp,
    }));
  };

  onClickExample = (query: TQuery) => {
    if (query.datasource === undefined) {
      query.datasource = getDataSourceRef(this.props.dataSource);
    }

    this.props.onChange({
      ...query,
      refId: this.props.query.refId,
    });
    this.onToggleHelp();
  };

  renderCollapsedText(): string | null {
    const { datasource } = this.state;
    if (datasource?.getQueryDisplayText) {
      return datasource.getQueryDisplayText(this.props.query);
    }

    return null;
  }

  renderWarnings = (type: string): JSX.Element | null => {
    const { data, query } = this.props;
    const dataFilteredByRefId = filterPanelDataToQuery(data, query.refId)?.series ?? [];

    const allWarnings = dataFilteredByRefId.reduce((acc: QueryResultMetaNotice[], serie) => {
      if (!serie.meta?.notices) {
        return acc;
      }

      const warnings = filter(serie.meta.notices, (item: QueryResultMetaNotice) => item.severity === type) ?? [];
      return acc.concat(warnings);
    }, []);

    const uniqueWarnings = uniqBy(allWarnings, 'text');

    const hasWarnings = uniqueWarnings.length > 0;
    if (!hasWarnings) {
      return null;
    }

    const key = 'query-' + type + 's';
    const colour = type === 'warning' ? 'orange' : 'blue';
    const iconName = type === 'warning' ? 'exclamation-triangle' : 'file-landscape-alt';

    const listItems = uniqueWarnings.map((warning) => warning.text);
    const serializedWarnings = <List items={listItems} renderItem={(item) => <>{item}</>} />;

    return (
      <Badge
        key={key}
        color={colour}
        icon={iconName}
        text={
          <>
            {uniqueWarnings.length} {pluralize(type, uniqueWarnings.length)}
          </>
        }
        tooltip={serializedWarnings}
      />
    );
  };

  renderQueryLibraryEditingBadge = () => {
    const { queryLibraryRef } = this.props;
    return <QueryLibraryEditingBadge key="query-library-editing-badge" queryLibraryRef={queryLibraryRef} />;
  };

  renderExtraActions = () => {
    const { query, queries, data, onAddQuery, dataSource, app } = this.props;

    const unscopedActions = RowActionComponents.getAllExtraRenderAction();

    let scopedActions: QueryActionComponent[] = [];

    if (app !== undefined) {
      scopedActions = RowActionComponents.getScopedExtraRenderAction(app);
    }

    const extraActions = [...unscopedActions, ...scopedActions]
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

    extraActions.push(this.renderWarnings('info'));
    extraActions.push(this.renderWarnings('warning'));
    extraActions.push(<AdaptiveTelemetryQueryActions key="adaptive-telemetry-actions" query={query} />);
    extraActions.push(this.renderQueryLibraryEditingBadge());

    return extraActions;
  };

  renderActions = (props: QueryOperationRowRenderProps) => {
    const {
      query,
      hideHideQueryButton: hideHideQueryButton = false,
      onReplace,
      onQueryReplacedFromLibrary,
      queryLibraryRef,
    } = this.props;
    const { datasource, showingHelp } = this.state;
    const isHidden = !!query.hide;

    const hasEditorHelp = datasource?.components?.QueryEditorHelp;
    const isEditingQueryLibrary = queryLibraryRef !== undefined;

    return (
      <>
        {hasEditorHelp && (
          <QueryOperationToggleAction
            title={t('query-operation.header.datasource-help', 'Show data source help')}
            icon="question-circle"
            onClick={this.onToggleHelp}
            active={showingHelp}
          />
        )}
        {this.renderExtraActions()}
        <MaybeQueryLibrarySaveButton
          query={query}
          queryLibraryRef={queryLibraryRef}
          app={this.props.app}
          onUpdateSuccess={this.onExitQueryLibraryEditingMode}
        />
        {isEditingQueryLibrary && (
          <>
            <QueryOperationAction
              title={t('query-operation.header.cancel-query-library-edit', 'Cancel editing from library')}
              icon="times"
              onClick={this.onCancelQueryLibraryEdit}
            />
            <Divider direction="vertical" spacing={0} />
          </>
        )}
        {!isEditingQueryLibrary && (
          <QueryOperationAction
            title={t('query-operation.header.duplicate-query', 'Duplicate query')}
            icon="copy"
            onClick={this.onCopyQuery}
          />
        )}
        {!isEditingQueryLibrary && (
          <ReplaceQueryFromLibrary
            datasourceFilters={datasource?.name ? [datasource.name] : []}
            onSelectQuery={(query) => {
              onQueryReplacedFromLibrary?.();
              onReplace?.(query);
            }}
            app={this.props.app}
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
            onClick={this.onHideQuery}
          />
        ) : null}
        {!isEditingQueryLibrary && (
          <QueryOperationAction
            title={t('query-operation.header.remove-query', 'Remove query')}
            icon="trash-alt"
            onClick={this.onRemoveQuery}
          />
        )}
      </>
    );
  };

  renderHeader = (props: QueryOperationRowRenderProps) => {
    const { app, query, dataSource, onChangeDataSource, onChange, queries, renderHeaderExtras, hideRefId } = this.props;

    return (
      <QueryEditorRowHeader
        query={query}
        queries={queries}
        onChangeDataSource={onChangeDataSource}
        dataSource={dataSource}
        hidden={query.hide}
        onChange={onChange}
        collapsedText={!props.isOpen ? this.renderCollapsedText() : null}
        renderExtras={renderHeaderExtras}
        alerting={app === CoreApp.UnifiedAlerting}
        hideRefId={hideRefId}
      />
    );
  };

  render() {
    const { query, index, visualization, collapsable, hideActionButtons, isOpen, onQueryOpenChanged } = this.props;
    const { datasource, showingHelp, data } = this.state;
    const isHidden = query.hide;
    const error =
      data?.error && data.error.refId === query.refId ? data.error : data?.errors?.find((e) => e.refId === query.refId);
    const rowClasses = classNames('query-editor-row', {
      'query-editor-row--disabled': isHidden,
      'gf-form-disabled': isHidden,
    });

    if (!datasource) {
      return null;
    }

    const editor = this.renderPluginEditor();
    const DatasourceCheatsheet = datasource.components?.QueryEditorHelp;

    return (
      <div data-testid="query-editor-row" aria-label={selectors.components.QueryEditorRows.rows}>
        <QueryOperationRow
          id={this.id}
          draggable={!hideActionButtons}
          collapsable={collapsable}
          index={index}
          headerElement={this.renderHeader}
          actions={hideActionButtons ? undefined : this.renderActions}
          isOpen={isOpen}
          onOpen={onQueryOpenChanged}
        >
          <div className={rowClasses} id={this.id}>
            <ErrorBoundaryAlert>
              {showingHelp && DatasourceCheatsheet && (
                <OperationRowHelp>
                  <DatasourceCheatsheet
                    onClickExample={(query) => this.onClickExample(query)}
                    query={this.props.query}
                    datasource={datasource}
                  />
                </OperationRowHelp>
              )}
              {editor}
            </ErrorBoundaryAlert>
            {error && <QueryErrorAlert error={error} />}
            {visualization}
          </div>
        </QueryOperationRow>
      </div>
    );
  }
}

export function QueryLibraryEditingBadge(props: { queryLibraryRef?: string }) {
  const { queryLibraryEnabled } = useQueryLibraryContext();
  const { queryLibraryRef } = props;

  if (!queryLibraryEnabled || !queryLibraryRef) {
    return null;
  }

  return (
    <Badge
      color="blue"
      icon="book"
      text={t('query-operation.query-library.from-library', 'Editing From Query Library')}
      tooltip={t('query-operation.query-library.editing-tooltip', 'Editing query from library ({{queryLibraryRef}})', {
        queryLibraryRef,
      })}
    />
  );
}

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

// Will render anything only if query library is enabled
function MaybeQueryLibrarySaveButton(props: {
  query: DataQuery;
  app?: CoreApp;
  queryLibraryRef?: string;
  onUpdateSuccess?: () => void;
}) {
  const { renderSaveQueryButton } = useQueryLibraryContext();
  return renderSaveQueryButton(props.query, props.app, props.queryLibraryRef, props.onUpdateSuccess);
}

interface ReplaceQueryFromLibraryProps<TQuery extends DataQuery> {
  datasourceFilters: string[];
  onSelectQuery: (query: DataQuery) => void;
  app?: CoreApp;
}

function ReplaceQueryFromLibrary<TQuery extends DataQuery>({
  datasourceFilters,
  onSelectQuery,
  app,
}: ReplaceQueryFromLibraryProps<TQuery>) {
  const { openDrawer, queryLibraryEnabled } = useQueryLibraryContext();

  const onReplaceQueryFromLibrary = () => {
    openDrawer(datasourceFilters, onSelectQuery, { isReplacingQuery: true, context: app });
  };

  return queryLibraryEnabled ? (
    <QueryOperationAction
      title={t('query-operation.header.replace-query-from-library', 'Replace with query from library')}
      icon="book"
      onClick={onReplaceQueryFromLibrary}
    />
  ) : null;
}

function AdaptiveTelemetryQueryActions({ query }: { query: DataQuery }) {
  try {
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
  } catch (error) {
    // If `usePluginComponents` isn't properly resolved, tests will fail with 'setPluginComponentsHook(options) can only be used after the Grafana instance has started.'
    // This will be resolved in https://github.com/grafana/grafana/pull/92983
    // In this case, Return `null` like when there are no extensions.
    return null;
  }
}
