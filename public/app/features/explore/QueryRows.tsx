// Libraries
import React, { PureComponent } from 'react';
import { ExploreId } from 'app/types/explore';
import { StoreState } from 'app/types';
import { connect, ConnectedProps } from 'react-redux';
import { getDatasourceSrv } from '../plugins/datasource_srv';
import { runQueries, changeQueriesAction } from './state/query';
import { CoreApp, DataQuery } from '@grafana/data';
import { highlightLogsExpressionAction } from './state/explorePane';
import { getNextRefIdChar } from 'app/core/utils/query';
import { QueryEditorRows } from '../query/components/QueryEditorRows';

interface OwnProps {
  exploreId: ExploreId;
}

class QueryRows extends PureComponent<OwnProps & ConnectedProps<typeof connector>> {
  onChange = (queries: DataQuery[]) => {
    const { exploreId } = this.props;
    this.props.changeQueriesAction({ queries, exploreId });

    // onChange = (query: DataQuery, index: number) => {
    //   const { datasourceInstance, exploreId } = this.props;
    //   this.props.changeQuery(exploreId, query, index);

    //   if (query && datasourceInstance?.getHighlighterExpression && index === 0) {
    //     // Live preview of log search matches. Only use on first row for now
    //     this.updateLogsHighlights(query);
    //   }
    // };

    // updateLogsHighlights = debounce((value: DataQuery) => {
    //   const { datasourceInstance } = this.props;
    //   if (datasourceInstance?.getHighlighterExpression) {
    //     const { exploreId } = this.props;
    //     const expressions = datasourceInstance.getHighlighterExpression(value);
    //     this.props.highlightLogsExpressionAction({ exploreId, expressions });
    //   }
    // }, 500);
  };

  onAddQuery = (query: DataQuery) => {
    this.onChange([...this.props.queries, { ...query, refId: getNextRefIdChar(this.props.queries) }]);
  };

  runQueries = () => {
    this.props.runQueries(this.props.exploreId);
  };

  render() {
    const { queries, datasourceInstance, history } = this.props;
    const dsSettings = getDatasourceSrv().getInstanceSettings(datasourceInstance?.name)!;

    return (
      <QueryEditorRows
        dsSettings={dsSettings}
        queries={queries}
        onQueriesChange={this.onChange}
        onAddQuery={this.onAddQuery}
        onRunQueries={this.runQueries}
        data={this.props.queryResponse}
        app={CoreApp.Explore}
        history={history}
      />
    );
  }
}

function mapStateToProps(state: StoreState, { exploreId }: OwnProps) {
  const explore = state.explore;
  const { queries, datasourceInstance, queryResponse, history } = explore[exploreId]!;

  return {
    queries,
    datasourceInstance,
    queryResponse,
    history,
  };
}

const mapDispatchToProps = {
  changeQueriesAction,
  highlightLogsExpressionAction,
  runQueries,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export default connector(QueryRows);
