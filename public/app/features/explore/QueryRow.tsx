// Libraries
import React, { PureComponent } from 'react';
import _ from 'lodash';
import { hot } from 'react-hot-loader';
// @ts-ignore
import { connect } from 'react-redux';

// Components
import QueryEditor from './QueryEditor';

// Actions
import { changeQuery, modifyQueries, runQueries, addQueryRow } from './state/actions';

// Types
import { StoreState } from 'app/types';
import {
  TimeRange,
  DataQuery,
  DataSourceApi,
  QueryFixAction,
  DataSourceStatus,
  PanelData,
  DataQueryError,
} from '@grafana/ui';
import { HistoryItem, ExploreItemState, ExploreId, ExploreMode } from 'app/types/explore';
import { Emitter } from 'app/core/utils/emitter';
import { highlightLogsExpressionAction, removeQueryRowAction } from './state/actionTypes';
import QueryStatus from './QueryStatus';

interface PropsFromParent {
  exploreId: ExploreId;
  index: number;
  exploreEvents: Emitter;
}

interface QueryRowProps extends PropsFromParent {
  addQueryRow: typeof addQueryRow;
  changeQuery: typeof changeQuery;
  className?: string;
  exploreId: ExploreId;
  datasourceInstance: DataSourceApi;
  datasourceStatus: DataSourceStatus;
  highlightLogsExpressionAction: typeof highlightLogsExpressionAction;
  history: HistoryItem[];
  query: DataQuery;
  modifyQueries: typeof modifyQueries;
  range: TimeRange;
  removeQueryRowAction: typeof removeQueryRowAction;
  runQueries: typeof runQueries;
  queryResponse: PanelData;
  latency: number;
  queryErrors: DataQueryError[];
  mode: ExploreMode;
}

export class QueryRow extends PureComponent<QueryRowProps> {
  onRunQuery = () => {
    const { exploreId } = this.props;
    this.props.runQueries(exploreId);
  };

  onChange = (query: DataQuery, override?: boolean) => {
    const { datasourceInstance, exploreId, index } = this.props;
    this.props.changeQuery(exploreId, query, index, override);
    if (query && !override && datasourceInstance.getHighlighterExpression && index === 0) {
      // Live preview of log search matches. Only use on first row for now
      this.updateLogsHighlights(query);
    }
  };

  componentWillUnmount() {
    console.log('QueryRow will unmount');
  }

  onClickAddButton = () => {
    const { exploreId, index } = this.props;
    this.props.addQueryRow(exploreId, index);
  };

  onClickClearButton = () => {
    this.onChange(null, true);
  };

  onClickHintFix = (action: QueryFixAction) => {
    const { datasourceInstance, exploreId, index } = this.props;
    if (datasourceInstance && datasourceInstance.modifyQuery) {
      const modifier = (queries: DataQuery, action: QueryFixAction) => datasourceInstance.modifyQuery(queries, action);
      this.props.modifyQueries(exploreId, action, index, modifier);
    }
  };

  onClickRemoveButton = () => {
    const { exploreId, index } = this.props;
    this.props.removeQueryRowAction({ exploreId, index });
    this.props.runQueries(exploreId);
  };

  updateLogsHighlights = _.debounce((value: DataQuery) => {
    const { datasourceInstance } = this.props;
    if (datasourceInstance.getHighlighterExpression) {
      const { exploreId } = this.props;
      const expressions = datasourceInstance.getHighlighterExpression(value);
      this.props.highlightLogsExpressionAction({ exploreId, expressions });
    }
  }, 500);

  render() {
    const {
      datasourceInstance,
      history,
      query,
      exploreEvents,
      range,
      datasourceStatus,
      queryResponse,
      latency,
      queryErrors,
      mode,
    } = this.props;
    let QueryField;

    if (mode === ExploreMode.Metrics && datasourceInstance.components.ExploreMetricsQueryField) {
      QueryField = datasourceInstance.components.ExploreMetricsQueryField;
    } else if (mode === ExploreMode.Logs && datasourceInstance.components.ExploreLogsQueryField) {
      QueryField = datasourceInstance.components.ExploreLogsQueryField;
    } else {
      QueryField = datasourceInstance.components.ExploreQueryField;
    }

    return (
      <div className="query-row">
        <div className="query-row-status">
          <QueryStatus queryResponse={queryResponse} latency={latency} />
        </div>
        <div className="query-row-field flex-shrink-1">
          {QueryField ? (
            <QueryField
              datasource={datasourceInstance}
              datasourceStatus={datasourceStatus}
              query={query}
              history={history}
              onRunQuery={this.onRunQuery}
              onHint={this.onClickHintFix}
              onChange={this.onChange}
              panelData={null}
              queryResponse={queryResponse}
            />
          ) : (
            <QueryEditor
              error={queryErrors}
              datasource={datasourceInstance}
              onQueryChange={this.onChange}
              onExecuteQuery={this.onRunQuery}
              initialQuery={query}
              exploreEvents={exploreEvents}
              range={range}
            />
          )}
        </div>
        <div className="gf-form-inline flex-shrink-0">
          <div className="gf-form">
            <button className="gf-form-label gf-form-label--btn" onClick={this.onClickClearButton}>
              <i className="fa fa-times" />
            </button>
          </div>
          <div className="gf-form">
            <button className="gf-form-label gf-form-label--btn" onClick={this.onClickAddButton}>
              <i className="fa fa-plus" />
            </button>
          </div>
          <div className="gf-form">
            <button className="gf-form-label gf-form-label--btn" onClick={this.onClickRemoveButton}>
              <i className="fa fa-minus" />
            </button>
          </div>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state: StoreState, { exploreId, index }: QueryRowProps) {
  const explore = state.explore;
  const item: ExploreItemState = explore[exploreId];
  const {
    datasourceInstance,
    history,
    queries,
    range,
    datasourceError,
    graphResult,
    loadingState,
    latency,
    queryErrors,
    mode,
  } = item;
  const query = queries[index];
  const datasourceStatus = datasourceError ? DataSourceStatus.Disconnected : DataSourceStatus.Connected;
  const error = queryErrors.filter(queryError => queryError.refId === query.refId)[0];
  const series = graphResult ? graphResult : []; // TODO: use SeriesData
  const queryResponse: PanelData = {
    series,
    state: loadingState,
    error,
  };

  return {
    datasourceInstance,
    history,
    query,
    range,
    datasourceStatus,
    queryResponse,
    latency,
    queryErrors,
    mode,
  };
}

const mapDispatchToProps = {
  addQueryRow,
  changeQuery,
  highlightLogsExpressionAction,
  modifyQueries,
  removeQueryRowAction,
  runQueries,
};

export default hot(module)(connect(
  mapStateToProps,
  mapDispatchToProps
)(QueryRow) as React.ComponentType<PropsFromParent>);
