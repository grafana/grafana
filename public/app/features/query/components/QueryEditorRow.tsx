// Libraries
import React, { PureComponent } from 'react';
import classNames from 'classnames';
import _ from 'lodash';
// Utils & Services
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { AngularComponent, getAngularLoader } from '@grafana/runtime';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { ErrorBoundaryAlert, HorizontalGroup } from '@grafana/ui';
import {
  DataQuery,
  DataSourceApi,
  LoadingState,
  PanelData,
  PanelEvents,
  TimeRange,
  toLegacyResponseData,
  EventBusExtended,
  DataSourceInstanceSettings,
  EventBusSrv,
} from '@grafana/data';
import { QueryEditorRowTitle } from './QueryEditorRowTitle';
import {
  QueryOperationRow,
  QueryOperationRowRenderProps,
} from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { QueryOperationAction } from 'app/core/components/QueryOperationRow/QueryOperationAction';
import { DashboardModel } from '../../dashboard/state/DashboardModel';
import { selectors } from '@grafana/e2e-selectors';
import { PanelModel } from 'app/features/dashboard/state';

interface Props {
  data: PanelData;
  query: DataQuery;
  queries: DataQuery[];
  dsSettings: DataSourceInstanceSettings;
  id: string;
  index: number;
  onAddQuery: (query?: DataQuery) => void;
  onRemoveQuery: (query: DataQuery) => void;
  onChange: (query: DataQuery) => void;
  onRunQuery: () => void;
}

interface State {
  loadedDataSourceIdentifier?: string | null;
  datasource: DataSourceApi | null;
  hasTextEditMode: boolean;
  data?: PanelData;
  isOpen?: boolean;
}

export class QueryEditorRow extends PureComponent<Props, State> {
  element: HTMLElement | null = null;
  angularScope: AngularQueryComponentScope | null;
  angularQueryEditor: AngularComponent | null = null;

  state: State = {
    datasource: null,
    hasTextEditMode: false,
    data: undefined,
    isOpen: true,
  };

  componentDidMount() {
    this.loadDatasource();
  }

  componentWillUnmount() {
    if (this.angularQueryEditor) {
      this.angularQueryEditor.destroy();
    }
  }

  getAngularQueryComponentScope(): AngularQueryComponentScope {
    const { query, onChange, onRunQuery, queries } = this.props;
    const { datasource } = this.state;
    const panel = new PanelModel({ targets: queries });
    const dashboard = {} as DashboardModel;

    return {
      datasource: datasource,
      target: query,
      panel: panel,
      dashboard: dashboard,
      refresh: () => {
        // Old angular editors modify the query model and just call refresh
        onChange(query);
        onRunQuery();
      },
      render: () => () => console.log('legacy render function called, it does nothing'),
      events: new EventBusSrv(),
      range: getTimeSrv().timeRange(),
    };
  }

  getQueryDataSourceIdentifier(): string | null | undefined {
    const { query, dsSettings } = this.props;
    return query.datasource ?? dsSettings.name;
  }

  async loadDatasource() {
    const dataSourceSrv = getDatasourceSrv();
    let datasource: DataSourceApi;
    const dataSourceIdentifier = this.getQueryDataSourceIdentifier();

    try {
      datasource = await dataSourceSrv.get(dataSourceIdentifier);
    } catch (error) {
      datasource = await dataSourceSrv.get();
    }

    this.setState({
      datasource,
      loadedDataSourceIdentifier: dataSourceIdentifier,
      hasTextEditMode: _.has(datasource, 'components.QueryCtrl.prototype.toggleEditorMode'),
    });
  }

  componentDidUpdate(prevProps: Props) {
    const { datasource, loadedDataSourceIdentifier } = this.state;
    const { data, query } = this.props;

    if (data !== prevProps.data) {
      this.setState({ data: filterPanelDataToQuery(data, query.refId) });

      if (this.angularScope) {
        this.angularScope.range = getTimeSrv().timeRange();
      }

      if (this.angularQueryEditor) {
        notifyAngularQueryEditorsOfData(this.angularScope!, data, this.angularQueryEditor);
      }
    }

    // check if we need to load another datasource
    if (datasource && loadedDataSourceIdentifier !== this.getQueryDataSourceIdentifier()) {
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

  renderPluginEditor = () => {
    const { query, onChange, queries, onRunQuery } = this.props;
    const { datasource, data } = this.state;

    if (datasource?.components?.QueryCtrl) {
      return <div ref={element => (this.element = element)} />;
    }

    if (datasource?.components?.QueryEditor) {
      const QueryEditor = datasource.components.QueryEditor;

      return (
        <QueryEditor
          key={datasource?.name}
          query={query}
          datasource={datasource}
          onChange={onChange}
          onRunQuery={onRunQuery}
          data={data}
          range={getTimeSrv().timeRange()}
          queries={queries}
        />
      );
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
    this.props.onRemoveQuery(this.props.query);
  };

  onCopyQuery = () => {
    const copy = _.cloneDeep(this.props.query);
    this.props.onAddQuery(copy);
  };

  onDisableQuery = () => {
    const { query } = this.props;
    this.props.onChange({ ...query, hide: !query.hide });
    this.props.onRunQuery();
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

  renderActions = (props: QueryOperationRowRenderProps) => {
    const { query } = this.props;
    const { hasTextEditMode } = this.state;
    const isDisabled = query.hide;

    return (
      <HorizontalGroup width="auto">
        {hasTextEditMode && (
          <QueryOperationAction
            title="Toggle text edit mode"
            icon="pen"
            onClick={e => {
              this.onToggleEditMode(e, props);
            }}
          />
        )}
        <QueryOperationAction title="Duplicate query" icon="copy" onClick={this.onCopyQuery} />
        <QueryOperationAction
          title="Disable/enable query"
          icon={isDisabled ? 'eye-slash' : 'eye'}
          onClick={this.onDisableQuery}
        />
        <QueryOperationAction title="Remove query" icon="trash-alt" onClick={this.onRemoveQuery} />
      </HorizontalGroup>
    );
  };

  renderTitle = (props: QueryOperationRowRenderProps) => {
    const { query, dsSettings, onChange, queries } = this.props;
    const { datasource } = this.state;
    const isDisabled = query.hide;

    return (
      <QueryEditorRowTitle
        query={query}
        queries={queries}
        inMixedMode={dsSettings.meta.mixed}
        dataSourceName={datasource!.name}
        disabled={isDisabled}
        onClick={e => this.onToggleEditMode(e, props)}
        onChange={onChange}
        collapsedText={!props.isOpen ? this.renderCollapsedText() : null}
      />
    );
  };

  render() {
    const { query, id, index } = this.props;
    const { datasource } = this.state;
    const isDisabled = query.hide;

    const rowClasses = classNames('query-editor-row', {
      'query-editor-row--disabled': isDisabled,
      'gf-form-disabled': isDisabled,
    });

    if (!datasource) {
      return null;
    }

    const editor = this.renderPluginEditor();

    return (
      <div aria-label={selectors.components.QueryEditorRows.rows}>
        <QueryOperationRow
          id={id}
          draggable={true}
          index={index}
          headerElement={this.renderTitle}
          actions={this.renderActions}
          onOpen={this.onOpen}
        >
          <div className={rowClasses}>
            <ErrorBoundaryAlert>{editor}</ErrorBoundaryAlert>
          </div>
        </QueryOperationRow>
      </div>
    );
  }
}

// To avoid sending duplicate events for each row we have this global cached object here
// So we can check if we already emitted this legacy data event
let globalLastPanelDataCache: PanelData | null = null;

function notifyAngularQueryEditorsOfData(scope: AngularQueryComponentScope, data: PanelData, editor: AngularComponent) {
  if (data === globalLastPanelDataCache) {
    return;
  }

  globalLastPanelDataCache = data;

  if (data.state === LoadingState.Done) {
    const legacy = data.series.map(v => toLegacyResponseData(v));
    scope.events.emit(PanelEvents.dataReceived, legacy);
  } else if (data.state === LoadingState.Error) {
    scope.events.emit(PanelEvents.dataError, data.error);
  }

  // Some query controllers listen to data error events and need a digest
  // for some reason this needs to be done in next tick
  setTimeout(editor.digest);
}

export interface AngularQueryComponentScope {
  target: DataQuery;
  panel: PanelModel;
  dashboard: DashboardModel;
  events: EventBusExtended;
  refresh: () => void;
  render: () => void;
  datasource: DataSourceApi | null;
  toggleEditorMode?: () => void;
  getCollapsedText?: () => string;
  range: TimeRange;
}

/**
 * Get a version of the PanelData limited to the query we are looking at
 */
export function filterPanelDataToQuery(data: PanelData, refId: string): PanelData | undefined {
  const series = data.series.filter(series => series.refId === refId);

  // No matching series
  if (!series.length) {
    // If there was an error with no data, pass it to the QueryEditors
    if (data.error && !data.series.length) {
      return {
        ...data,
        state: LoadingState.Error,
      };
    }
    return undefined;
  }

  // Only say this is an error if the error links to the query
  let state = LoadingState.Done;
  const error = data.error && data.error.refId === refId ? data.error : undefined;
  if (error) {
    state = LoadingState.Error;
  }

  const timeRange = data.timeRange;

  return {
    ...data,
    state,
    series,
    error,
    timeRange,
  };
}
