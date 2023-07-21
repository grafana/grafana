// Libraries
import classNames from 'classnames';
import { cloneDeep, filter, has, uniqBy, uniqueId } from 'lodash';
import pluralize from 'pluralize';
import React, { PureComponent, ReactNode } from 'react';

// Utils & Services
import {
  CoreApp,
  DataQuery,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourcePluginContextProvider,
  EventBusExtended,
  EventBusSrv,
  HistoryItem,
  LoadingState,
  PanelData,
  PanelEvents,
  QueryResultMetaNotice,
  TimeRange,
  toLegacyResponseData,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { AngularComponent, getAngularLoader, getDataSourceSrv } from '@grafana/runtime';
import { Badge, ErrorBoundaryAlert, HorizontalGroup } from '@grafana/ui';
import { OperationRowHelp } from 'app/core/components/QueryOperationRow/OperationRowHelp';
import {
  QueryOperationAction,
  QueryOperationToggleAction,
} from 'app/core/components/QueryOperationRow/QueryOperationAction';
import {
  QueryOperationRow,
  QueryOperationRowRenderProps,
} from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';

import { RowActionComponents } from './QueryActionComponent';
import { QueryEditorRowHeader } from './QueryEditorRowHeader';
import { QueryErrorAlert } from './QueryErrorAlert';

interface Props<TQuery extends DataQuery> {
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
  onRunQuery: () => void;
  visualization?: ReactNode;
  hideDisableQuery?: boolean;
  app?: CoreApp;
  history?: Array<HistoryItem<TQuery>>;
  eventBus?: EventBusExtended;
  alerting?: boolean;
  onQueryCopied?: () => void;
  onQueryRemoved?: () => void;
  onQueryToggled?: (queryStatus?: boolean | undefined) => void;
  collapsable?: boolean;
}

interface State<TQuery extends DataQuery> {
  /** DatasourceUid or ds variable expression used to resolve current datasource */
  queriedDataSourceIdentifier?: string | null;
  datasource: DataSourceApi<TQuery> | null;
  datasourceUid?: string | null;
  hasTextEditMode: boolean;
  data?: PanelData;
  isOpen?: boolean;
  showingHelp: boolean;
}

export class QueryEditorRow<TQuery extends DataQuery> extends PureComponent<Props<TQuery>, State<TQuery>> {
  element: HTMLElement | null = null;
  angularScope: AngularQueryComponentScope<TQuery> | null = null;
  angularQueryEditor: AngularComponent | null = null;
  dataSourceSrv = getDataSourceSrv();
  id = '';

  state: State<TQuery> = {
    datasource: null,
    hasTextEditMode: false,
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

  componentWillUnmount() {
    if (this.angularQueryEditor) {
      this.angularQueryEditor.destroy();
    }
  }

  getAngularQueryComponentScope(): AngularQueryComponentScope<TQuery> {
    const { query, queries } = this.props;
    const { datasource } = this.state;
    const panel = new PanelModel({ targets: queries });
    const dashboard = {} as DashboardModel;

    const me = this;

    return {
      datasource: datasource,
      target: query,
      panel: panel,
      dashboard: dashboard,
      refresh: () => {
        // Old angular editors modify the query model and just call refresh
        // Important that this use this.props here so that as this function is only created on mount and it's
        // important not to capture old prop functions in this closure

        // the "hide" attribute of the queries can be changed from the "outside",
        // it will be applied to "this.props.query.hide", but not to "query.hide".
        // so we have to apply it.
        if (query.hide !== me.props.query.hide) {
          query.hide = me.props.query.hide;
        }

        this.props.onChange(query);
        this.props.onRunQuery();
      },
      render: () => () => console.log('legacy render function called, it does nothing'),
      events: this.props.eventBus || new EventBusSrv(),
      range: getTimeSrv().timeRange(),
    };
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
      hasTextEditMode: has(datasource, 'components.QueryCtrl.prototype.toggleEditorMode'),
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

      if (this.angularScope) {
        this.angularScope.range = getTimeSrv().timeRange();
      }

      if (this.angularQueryEditor && dataFilteredByRefId) {
        notifyAngularQueryEditorsOfData(this.angularScope!, dataFilteredByRefId, this.angularQueryEditor);
      }
    }

    // check if we need to load another datasource
    if (datasource && queriedDataSourceIdentifier !== this.getInterpolatedDataSourceUID()) {
      if (this.angularQueryEditor) {
        this.angularQueryEditor.destroy();
        this.angularQueryEditor = null;
      }
      this.loadDatasource();
      return;
    }

    if (!this.element || this.angularQueryEditor) {
      return;
    }

    this.renderAngularQueryEditor();
  }

  renderAngularQueryEditor = () => {
    if (!this.element) {
      return;
    }

    if (this.angularQueryEditor) {
      this.angularQueryEditor.destroy();
      this.angularQueryEditor = null;
    }

    const loader = getAngularLoader();
    const template = '<plugin-component type="query-ctrl" />';
    const scopeProps = { ctrl: this.getAngularQueryComponentScope() };

    this.angularQueryEditor = loader.load(this.element, scopeProps, template);
    this.angularScope = scopeProps.ctrl;
  };

  onOpen = () => {
    this.renderAngularQueryEditor();
  };

  getReactQueryEditor(ds: DataSourceApi<TQuery>) {
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
    const { query, onChange, queries, onRunQuery, onAddQuery, app = CoreApp.PanelEditor, history } = this.props;
    const { datasource, data } = this.state;

    if (this.isWaitingForDatasourceToLoad()) {
      return null;
    }

    if (datasource?.components?.QueryCtrl) {
      return <div ref={(element) => (this.element = element)} />;
    }

    if (datasource) {
      let QueryEditor = this.getReactQueryEditor(datasource);

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
              range={getTimeSrv().timeRange()}
              queries={queries}
              app={app}
              history={history}
            />
          </DataSourcePluginContextProvider>
        );
      }
    }

    return <div>Data source plugin does not export any Query Editor component</div>;
  };

  onToggleEditMode = (e: React.MouseEvent, props: QueryOperationRowRenderProps) => {
    e.stopPropagation();
    if (this.angularScope && this.angularScope.toggleEditorMode) {
      this.angularScope.toggleEditorMode();
      this.angularQueryEditor?.digest();
      if (!props.isOpen) {
        props.onOpen();
      }
    }
  };

  onRemoveQuery = () => {
    const { onRemoveQuery, query, onQueryRemoved } = this.props;
    onRemoveQuery(query);

    if (onQueryRemoved) {
      onQueryRemoved();
    }
  };

  onCopyQuery = () => {
    const { query, onAddQuery, onQueryCopied } = this.props;
    const copy = cloneDeep(query);
    onAddQuery(copy);

    if (onQueryCopied) {
      onQueryCopied();
    }
  };

  onDisableQuery = () => {
    const { query, onChange, onRunQuery, onQueryToggled } = this.props;
    onChange({ ...query, hide: !query.hide });
    onRunQuery();

    if (onQueryToggled) {
      onQueryToggled(query.hide);
    }
  };

  onToggleHelp = () => {
    this.setState((state) => ({
      showingHelp: !state.showingHelp,
    }));
  };

  onClickExample = (query: TQuery) => {
    if (query.datasource === undefined) {
      query.datasource = { type: this.props.dataSource.type, uid: this.props.dataSource.uid };
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

    if (this.angularScope && this.angularScope.getCollapsedText) {
      return this.angularScope.getCollapsedText();
    }
    return null;
  }

  renderWarnings = (): JSX.Element | null => {
    const { data, query } = this.props;
    const dataFilteredByRefId = filterPanelDataToQuery(data, query.refId)?.series ?? [];

    const allWarnings = dataFilteredByRefId.reduce((acc: QueryResultMetaNotice[], serie) => {
      if (!serie.meta?.notices) {
        return acc;
      }

      const warnings = filter(serie.meta.notices, { severity: 'warning' }) ?? [];
      return acc.concat(warnings);
    }, []);

    const uniqueWarnings = uniqBy(allWarnings, 'text');

    const hasWarnings = uniqueWarnings.length > 0;
    if (!hasWarnings) {
      return null;
    }

    const serializedWarnings = uniqueWarnings.map((warning) => warning.text).join('\n');

    return (
      <Badge
        color="orange"
        icon="exclamation-triangle"
        text={
          <>
            {uniqueWarnings.length} {pluralize('warning', uniqueWarnings.length)}
          </>
        }
        tooltip={serializedWarnings}
      />
    );
  };

  renderExtraActions = () => {
    const { query, queries, data, onAddQuery, dataSource } = this.props;

    const extraActions = RowActionComponents.getAllExtraRenderAction()
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

    extraActions.push(this.renderWarnings());

    return extraActions;
  };

  renderActions = (props: QueryOperationRowRenderProps) => {
    const { query, hideDisableQuery = false } = this.props;
    const { hasTextEditMode, datasource, showingHelp } = this.state;
    const isDisabled = !!query.hide;

    const hasEditorHelp = datasource?.components?.QueryEditorHelp;

    return (
      <HorizontalGroup width="auto">
        {hasEditorHelp && (
          <QueryOperationToggleAction
            title="Show data source help"
            icon="question-circle"
            onClick={this.onToggleHelp}
            active={showingHelp}
          />
        )}
        {hasTextEditMode && (
          <QueryOperationAction
            title="Toggle text edit mode"
            icon="pen"
            onClick={(e) => {
              this.onToggleEditMode(e, props);
            }}
          />
        )}
        {this.renderExtraActions()}
        <QueryOperationAction title="Duplicate query" icon="copy" onClick={this.onCopyQuery} />
        {!hideDisableQuery ? (
          <QueryOperationToggleAction
            title="Disable query"
            icon={isDisabled ? 'eye-slash' : 'eye'}
            active={isDisabled}
            onClick={this.onDisableQuery}
          />
        ) : null}
        <QueryOperationAction title="Remove query" icon="trash-alt" onClick={this.onRemoveQuery} />
      </HorizontalGroup>
    );
  };

  renderHeader = (props: QueryOperationRowRenderProps) => {
    const { alerting, query, dataSource, onChangeDataSource, onChange, queries, renderHeaderExtras } = this.props;

    return (
      <QueryEditorRowHeader
        query={query}
        queries={queries}
        onChangeDataSource={onChangeDataSource}
        dataSource={dataSource}
        disabled={query.hide}
        onClick={(e) => this.onToggleEditMode(e, props)}
        onChange={onChange}
        collapsedText={!props.isOpen ? this.renderCollapsedText() : null}
        renderExtras={renderHeaderExtras}
        alerting={alerting}
      />
    );
  };

  render() {
    const { query, index, visualization, collapsable } = this.props;
    const { datasource, showingHelp, data } = this.state;
    const isDisabled = query.hide;

    const rowClasses = classNames('query-editor-row', {
      'query-editor-row--disabled': isDisabled,
      'gf-form-disabled': isDisabled,
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
          draggable={true}
          collapsable={collapsable}
          index={index}
          headerElement={this.renderHeader}
          actions={this.renderActions}
          onOpen={this.onOpen}
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
            {data?.error && data.error.refId === query.refId && <QueryErrorAlert error={data.error} />}
            {visualization}
          </div>
        </QueryOperationRow>
      </div>
    );
  }
}

function notifyAngularQueryEditorsOfData<TQuery extends DataQuery>(
  scope: AngularQueryComponentScope<TQuery>,
  data: PanelData,
  editor: AngularComponent
) {
  if (data.state === LoadingState.Done) {
    const legacy = data.series.map((v) => toLegacyResponseData(v));
    scope.events.emit(PanelEvents.dataReceived, legacy);
  } else if (data.state === LoadingState.Error) {
    scope.events.emit(PanelEvents.dataError, data.error);
  }

  // Some query controllers listen to data error events and need a digest
  // for some reason this needs to be done in next tick
  setTimeout(editor.digest);
}

export interface AngularQueryComponentScope<TQuery extends DataQuery> {
  target: TQuery;
  panel: PanelModel;
  dashboard: DashboardModel;
  events: EventBusExtended;
  refresh: () => void;
  render: () => void;
  datasource: DataSourceApi<TQuery> | null;
  toggleEditorMode?: () => void;
  getCollapsedText?: () => string;
  range: TimeRange;
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
