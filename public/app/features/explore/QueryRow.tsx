// Libraries
import React, { PureComponent } from 'react';
import debounce from 'lodash/debounce';
import has from 'lodash/has';
import { hot } from 'react-hot-loader';
// @ts-ignore
import { connect } from 'react-redux';
// Components
import AngularQueryEditor from './QueryEditor';
import { QueryRowActions } from './QueryRowActions';
// Actions
import { changeQuery, modifyQueries, runQueries } from './state/actions';
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

import { ExploreItemState, ExploreId } from 'app/types/explore';
import { Emitter } from 'app/core/utils/emitter';
import { highlightLogsExpressionAction, removeQueryRowAction } from './state/actionTypes';
import { ErrorContainer } from './ErrorContainer';

interface PropsFromParent {
  exploreId: ExploreId;
  index: number;
  exploreEvents: Emitter;
}

export interface QueryRowProps extends PropsFromParent {
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

  setReactQueryEditor = () => {
    const { datasourceInstance } = this.props;
    let QueryEditor;

    // TODO:unification
    if (datasourceInstance.components?.ExploreMetricsQueryField) {
      QueryEditor = datasourceInstance.components.ExploreMetricsQueryField;
    } else if (datasourceInstance.components?.ExploreLogsQueryField) {
      QueryEditor = datasourceInstance.components.ExploreLogsQueryField;
    } else if (datasourceInstance.components?.ExploreQueryField) {
      QueryEditor = datasourceInstance.components.ExploreQueryField;
    } else {
      QueryEditor = datasourceInstance.components?.QueryEditor;
    }
    return QueryEditor;
  };

  renderQueryEditor = () => {
    const {
      datasourceInstance,
      history,
      query,
      exploreEvents,
      range,
      absoluteRange,
      queryResponse,
      exploreId,
    } = this.props;

    const queryErrors = queryResponse.error && queryResponse.error.refId === query.refId ? [queryResponse.error] : [];

    const ReactQueryEditor = this.setReactQueryEditor();

    if (ReactQueryEditor) {
      return (
        <ReactQueryEditor
          datasource={datasourceInstance}
          query={query}
          history={history}
          onRunQuery={this.onRunQuery}
          onBlur={noopOnBlur}
          onChange={this.onChange}
          data={queryResponse}
          absoluteRange={absoluteRange}
          exploreId={exploreId}
        />
      );
    }
    return (
      <AngularQueryEditor
        error={queryErrors}
        datasource={datasourceInstance}
        onQueryChange={this.onChange}
        onExecuteQuery={this.onRunQuery}
        initialQuery={query}
        exploreEvents={exploreEvents}
        range={range}
        textEditModeEnabled={this.state.textEditModeEnabled}
      />
    );
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
    const { datasourceInstance, query, queryResponse, latency } = this.props;

    const canToggleEditorModes = has(datasourceInstance, 'components.QueryCtrl.prototype.toggleEditorMode');
    const isNotStarted = queryResponse.state === LoadingState.NotStarted;
    const queryErrors = queryResponse.error && queryResponse.error.refId === query.refId ? [queryResponse.error] : [];

    return (
      <>
        <div className="query-row">
          <div className="query-row-field flex-shrink-1">{this.renderQueryEditor()}</div>
          <QueryRowActions
            canToggleEditorModes={canToggleEditorModes}
            isDisabled={query.hide}
            isNotStarted={isNotStarted}
            latency={latency}
            onClickToggleEditorMode={this.onClickToggleEditorMode}
            onClickToggleDisabled={this.onClickToggleDisabled}
            onClickRemoveButton={this.onClickRemoveButton}
          />
        </div>
        {queryErrors.length > 0 && <ErrorContainer queryError={queryErrors[0]} />}
      </>
    );
  }
}

function mapStateToProps(state: StoreState, { exploreId, index }: QueryRowProps) {
  const explore = state.explore;
  const item: ExploreItemState = explore[exploreId];
  const { datasourceInstance, history, queries, range, absoluteRange, queryResponse, latency } = item;
  const query = queries[index];

  return {
    datasourceInstance,
    history,
    query,
    range,
    absoluteRange,
    queryResponse,
    latency,
  };
}

const mapDispatchToProps = {
  changeQuery,
  highlightLogsExpressionAction,
  modifyQueries,
  removeQueryRowAction,
  runQueries,
};

export default hot(module)(
  connect(mapStateToProps, mapDispatchToProps)(QueryRow) as React.ComponentType<PropsFromParent>
);
