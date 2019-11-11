// Libraries
import React, { PureComponent } from 'react';
import debounce from 'lodash/debounce';
import has from 'lodash/has';
import { hot } from 'react-hot-loader';
// @ts-ignore
import { connect } from 'react-redux';
// Components
import QueryEditor from './QueryEditor';
import { QueryRowActions } from './QueryRowActions';
// Actions
import { changeQuery, modifyQueries, runQueries, addQueryRow } from './state/actions';
// Types
import { StoreState } from 'app/types';
import {
  DataQuery,
  DataSourceApi,
  PanelData,
  HistoryItem,
  TimeRange,
  AbsoluteTimeRange,
  LoadingState,
} from '@grafana/data';

import { ExploreItemState, ExploreId, ExploreMode } from 'app/types/explore';
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
  highlightLogsExpressionAction: typeof highlightLogsExpressionAction;
  history: HistoryItem[];
  query: DataQuery;
  modifyQueries: typeof modifyQueries;
  range: TimeRange;
  absoluteRange: AbsoluteTimeRange;
  removeQueryRowAction: typeof removeQueryRowAction;
  runQueries: typeof runQueries;
  queryResponse: PanelData;
  latency: number;
  mode: ExploreMode;
}

interface QueryRowState {
  textEditModeEnabled: boolean;
}

// Empty function to override blur execution on query field
const noopOnBlur = () => {};

export class QueryRow extends PureComponent<QueryRowProps, QueryRowState> {
  state: QueryRowState = {
    textEditModeEnabled: false,
  };

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

  onClickToggleDisabled = () => {
    const { exploreId, index, query } = this.props;
    const newQuery = {
      ...query,
      hide: !query.hide,
    };
    this.props.changeQuery(exploreId, newQuery, index, true);
  };

  onClickRemoveButton = () => {
    const { exploreId, index } = this.props;
    this.props.removeQueryRowAction({ exploreId, index });
    this.props.runQueries(exploreId);
  };

  onClickToggleEditorMode = () => {
    this.setState({ textEditModeEnabled: !this.state.textEditModeEnabled });
  };

  updateLogsHighlights = debounce((value: DataQuery) => {
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
      absoluteRange,
      queryResponse,
      latency,
      mode,
    } = this.props;

    const canToggleEditorModes =
      mode === ExploreMode.Metrics && has(datasourceInstance, 'components.QueryCtrl.prototype.toggleEditorMode');
    const isNotStarted = queryResponse.state === LoadingState.NotStarted;
    const queryErrors = queryResponse.error && queryResponse.error.refId === query.refId ? [queryResponse.error] : [];
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
        <div className="query-row-field flex-shrink-1">
          {QueryField ? (
            //@ts-ignore
            <QueryField
              datasource={datasourceInstance}
              query={query}
              history={history}
              onRunQuery={this.onRunQuery}
              onBlur={noopOnBlur}
              onChange={this.onChange}
              data={queryResponse}
              absoluteRange={absoluteRange}
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
              textEditModeEnabled={this.state.textEditModeEnabled}
            />
          )}
        </div>
        <div className="query-row-status">
          <QueryStatus queryResponse={queryResponse} latency={query.hide ? 0 : latency} />
        </div>
        <QueryRowActions
          canToggleEditorModes={canToggleEditorModes}
          isDisabled={query.hide}
          isNotStarted={isNotStarted}
          onClickToggleEditorMode={this.onClickToggleEditorMode}
          onClickToggleDisabled={this.onClickToggleDisabled}
          onClickAddButton={this.onClickAddButton}
          onClickRemoveButton={this.onClickRemoveButton}
        />
      </div>
    );
  }
}

function mapStateToProps(state: StoreState, { exploreId, index }: QueryRowProps) {
  const explore = state.explore;
  const item: ExploreItemState = explore[exploreId];
  const { datasourceInstance, history, queries, range, absoluteRange, latency, mode, queryResponse } = item;
  const query = queries[index];

  return {
    datasourceInstance,
    history,
    query,
    range,
    absoluteRange,
    queryResponse,
    latency,
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
