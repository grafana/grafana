// Libraries
import React, { PureComponent } from 'react';

// Types
import { DataQuery, PanelData, DataSourceSelectItem } from '@grafana/data';
import { QueryEditorRow } from './QueryEditorRow';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';

interface Props {
  // The query configuration
  queries: DataQuery[];
  datasource: DataSourceSelectItem;

  // Query editing
  onQueriesChange: (queries: DataQuery[]) => void;
  onAddQuery: (query: DataQuery) => void;
  onRunQueries: () => void;

  // Query Response Data
  data: PanelData;
}

export class QueryEditorRows extends PureComponent<Props> {
  onRemoveQuery = (query: DataQuery) => {
    this.props.onQueriesChange(this.props.queries.filter(item => item !== query));
  };

  onChangeQuery(query: DataQuery, index: number) {
    const { queries, onQueriesChange } = this.props;

    const old = queries[index];

    // ensure refId & datasource are maintained
    query.refId = old.refId;
    if (old.datasource) {
      query.datasource = old.datasource;
    }

    // update query in array
    onQueriesChange(
      queries.map((item, itemIndex) => {
        if (itemIndex === index) {
          return query;
        }
        return item;
      })
    );
  }

  onDragEnd = (result: DropResult) => {
    const { queries, onQueriesChange } = this.props;

    if (!result || !result.destination) {
      return;
    }

    const startIndex = result.source.index;
    const endIndex = result.destination.index;
    if (startIndex === endIndex) {
      return;
    }

    const update = Array.from(queries);
    const [removed] = update.splice(startIndex, 1);
    update.splice(endIndex, 0, removed);
    onQueriesChange(update);
  };

  render() {
    const { props } = this;

    return (
      <DragDropContext onDragEnd={this.onDragEnd}>
        <Droppable droppableId="transformations-list" direction="vertical">
          {provided => {
            return (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {props.queries.map((query, index) => (
                  <QueryEditorRow
                    dataSourceValue={query.datasource || props.datasource.value}
                    id={query.refId}
                    index={index}
                    key={query.refId}
                    data={props.data}
                    query={query}
                    onChange={query => this.onChangeQuery(query, index)}
                    onRemoveQuery={this.onRemoveQuery}
                    onAddQuery={this.props.onAddQuery}
                    onRunQuery={this.props.onRunQueries}
                    inMixedMode={props.datasource.meta.mixed}
                  />
                ))}
                {provided.placeholder}
              </div>
            );
          }}
        </Droppable>
      </DragDropContext>
    );
  }
}
