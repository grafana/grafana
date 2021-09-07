// Libraries
import React, { PureComponent } from 'react';

// Components
// import QueryRow from './QueryRow';

// Types
import { ExploreId } from 'app/types/explore';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';
import { QueryEditorRow } from '../query/components/QueryEditorRow';
import { StoreState } from 'app/types';
import { connect, ConnectedProps } from 'react-redux';
import { getDatasourceSrv } from '../plugins/datasource_srv';
import { changeQuery, addQueryRowAction, removeQueryRowAction, runQueries } from './state/query';
import { DataQuery } from '@grafana/data';
import { debounce } from 'lodash';
import { highlightLogsExpressionAction } from './state/explorePane';
import { getNextRefIdChar } from 'app/core/utils/query';

interface OwnProps {
  exploreId: ExploreId;
}

class QueryRows extends PureComponent<OwnProps & ConnectedProps<typeof connector>> {
  onChange = (query: DataQuery, index: number) => {
    const { datasourceInstance, exploreId } = this.props;
    this.props.changeQuery(exploreId, query, index);

    if (query && datasourceInstance?.getHighlighterExpression && index === 0) {
      // Live preview of log search matches. Only use on first row for now
      this.updateLogsHighlights(query);
    }
  };

  updateLogsHighlights = debounce((value: DataQuery) => {
    const { datasourceInstance } = this.props;
    if (datasourceInstance?.getHighlighterExpression) {
      const { exploreId } = this.props;
      const expressions = datasourceInstance.getHighlighterExpression(value);
      this.props.highlightLogsExpressionAction({ exploreId, expressions });
    }
  }, 500);

  onAddQuery = (query: DataQuery, index: number) => {
    const { exploreId } = this.props;
    this.props.addQueryRowAction({
      exploreId,
      index,
      query: { ...query, refId: getNextRefIdChar(this.props.queries) },
    });
  };

  onRemoveQuery = (index: number) => {
    const { exploreId } = this.props;
    this.props.removeQueryRowAction({ exploreId, index });
    this.runQueries();
  };

  runQueries = () => {
    this.props.runQueries(this.props.exploreId);
  };

  onDragEnd = (result: DropResult) => {
    // TODO: implement action to reorder queries
    // const { queries, onQueriesChange } = this.props;
    // if (!result || !result.destination) {
    //   return;
    // }
    // const startIndex = result.source.index;
    // const endIndex = result.destination.index;
    // if (startIndex === endIndex) {
    //   return;
    // }
    // const update = Array.from(queries);
    // const [removed] = update.splice(startIndex, 1);
    // update.splice(endIndex, 0, removed);
    // onQueriesChange(update);
  };

  render() {
    const { queries, datasourceInstance } = this.props;
    const dsSettings = getDatasourceSrv().getInstanceSettings(datasourceInstance?.name)!;

    return (
      <DragDropContext onDragEnd={() => {}}>
        <Droppable droppableId="explore-queries" direction="vertical">
          {(provided) => {
            return (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {queries.map((query, index) => {
                  return (
                    <QueryEditorRow
                      dataSource={dsSettings}
                      id={query.refId}
                      index={index}
                      key={query.refId}
                      // TODO: check how to build data
                      // data={data}
                      query={query}
                      // TODO: maybe show latency?
                      renderHeaderExtras={() => 'Latency: 0.3s'}
                      onChange={(newQuery) => this.onChange(newQuery, index)}
                      onRemoveQuery={() => this.onRemoveQuery(index)}
                      // Despite the name, this is used when duplicating a query
                      onAddQuery={(newQuery) => this.onAddQuery(newQuery, index)}
                      onRunQuery={this.runQueries}
                      queries={queries}
                    />
                  );
                })}
                {provided.placeholder}
              </div>
            );
          }}
        </Droppable>
      </DragDropContext>
    );
  }
}

function mapStateToProps(state: StoreState, { exploreId }: OwnProps) {
  const explore = state.explore;
  const { queries, datasourceInstance } = explore[exploreId]!;

  return {
    queries,
    datasourceInstance,
  };
}

const mapDispatchToProps = {
  changeQuery,
  addQueryRowAction,
  highlightLogsExpressionAction,
  removeQueryRowAction,
  runQueries,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export default connector(QueryRows);
