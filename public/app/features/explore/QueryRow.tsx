// Libraries
import React, { PureComponent } from 'react';
import { debounce, has } from 'lodash';
import { hot } from 'react-hot-loader';
import { connect, ConnectedProps } from 'react-redux';
import AngularQueryEditor from './QueryEditor';
import { QueryRowActions } from './QueryRowActions';
import { StoreState } from 'app/types';
import { DataQuery, LoadingState, DataSourceApi } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { ExploreItemState, ExploreId } from 'app/types/explore';
import { highlightLogsExpressionAction } from './state/explorePane';
import { ErrorContainer } from './ErrorContainer';
import { changeQuery, modifyQueries, removeQueryRowAction, runQueries } from './state/query';
import { HelpToggle } from '../query/components/HelpToggle';

interface OwnProps {
  exploreId: ExploreId;
  index: number;
}

type QueryRowProps = OwnProps & ConnectedProps<typeof connector>;

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
    if (query && !override && datasourceInstance?.getHighlighterExpression && index === 0) {
      // Live preview of log search matches. Only use on first row for now
      this.updateLogsHighlights(query);
    }
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

  setReactQueryEditor = (datasourceInstance: DataSourceApi) => {
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

  renderQueryEditor = (datasourceInstance: DataSourceApi) => {
    const { history, query, exploreEvents, range, queryResponse, exploreId } = this.props;

    const queryErrors = queryResponse.error && queryResponse.error.refId === query.refId ? [queryResponse.error] : [];

    const ReactQueryEditor = this.setReactQueryEditor(datasourceInstance);

    let QueryEditor: JSX.Element;
    if (ReactQueryEditor) {
      QueryEditor = (
        <ReactQueryEditor
          datasource={datasourceInstance}
          query={query}
          history={history}
          onRunQuery={this.onRunQuery}
          onBlur={noopOnBlur}
          onChange={this.onChange}
          data={queryResponse}
          range={range}
          exploreId={exploreId}
        />
      );
    } else {
      QueryEditor = (
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
    }

    const DatasourceCheatsheet = datasourceInstance.components?.QueryEditorHelp;
    return (
      <>
        {QueryEditor}
        {DatasourceCheatsheet && (
          <HelpToggle>
            <DatasourceCheatsheet onClickExample={(query) => this.onChange(query)} datasource={datasourceInstance!} />
          </HelpToggle>
        )}
      </>
    );
  };

  updateLogsHighlights = debounce((value: DataQuery) => {
    const { datasourceInstance } = this.props;
    if (datasourceInstance?.getHighlighterExpression) {
      const { exploreId } = this.props;
      const expressions = datasourceInstance.getHighlighterExpression(value);
      this.props.highlightLogsExpressionAction({ exploreId, expressions });
    }
  }, 500);

  render() {
    const { datasourceInstance, query, queryResponse, latency } = this.props;

    if (!datasourceInstance) {
      return <>Loading data source</>;
    }

    const canToggleEditorModes = has(datasourceInstance, 'components.QueryCtrl.prototype.toggleEditorMode');
    const isNotStarted = queryResponse.state === LoadingState.NotStarted;

    // We show error without refId in ResponseErrorContainer so this condition needs to match se we don't loose errors.
    const queryErrors = queryResponse.error && queryResponse.error.refId === query.refId ? [queryResponse.error] : [];

    return (
      <>
        <div className="query-row" aria-label={selectors.components.QueryEditorRows.rows}>
          <div className="query-row-field flex-shrink-1">{this.renderQueryEditor(datasourceInstance)}</div>
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

function mapStateToProps(state: StoreState, { exploreId, index }: OwnProps) {
  const explore = state.explore;
  const item: ExploreItemState = explore[exploreId]!;
  const { datasourceInstance, history, queries, range, absoluteRange, queryResponse, latency, eventBridge } = item;
  const query = queries[index];

  return {
    datasourceInstance,
    history,
    query,
    range,
    absoluteRange,
    queryResponse,
    latency,
    exploreEvents: eventBridge,
  };
}

const mapDispatchToProps = {
  changeQuery,
  highlightLogsExpressionAction,
  modifyQueries,
  removeQueryRowAction,
  runQueries,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export default hot(module)(connector(QueryRow));
