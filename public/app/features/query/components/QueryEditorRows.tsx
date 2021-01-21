// Libraries
import React, { PureComponent } from 'react';

// Types
import { DataQuery, DataSourceInstanceSettings, PanelData } from '@grafana/data';
import { QueryEditorRow } from './QueryEditorRow';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';

interface Props {
  // The query configuration
  queries: DataQuery[];
  dsSettings: DataSourceInstanceSettings;

  // Query editing
  onQueriesChange: (queries: DataQuery[]) => void;
  onAddQuery: (query: DataQuery) => void;
  onRunQueries: () => void;

  // Query Response Data
  data: PanelData;
}

export class QueryEditorRows extends PureComponent<Props> {
  onRemoveQuery = (query: DataQuery) => {
    this.props.onQueriesChange(this.props.queries.filter((item) => item !== query));
  };

  onChangeQuery(query: DataQuery, index: number) {
    const { queries, onQueriesChange } = this.props;

    const old = queries[index];

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
    const { dsSettings, data, queries } = this.props;

    return (
      <DragDropContext onDragEnd={this.onDragEnd}>
        <Droppable droppableId="transformations-list" direction="vertical">
          {(provided) => {
            return (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {queries.map((query, index) => (
                  <QueryEditorRow
                    dsSettings={dsSettings}
                    id={query.refId}
                    index={index}
                    key={query.refId}
                    data={data}
                    query={query}
                    onChange={(query) => this.onChangeQuery(query, index)}
                    onRemoveQuery={this.onRemoveQuery}
                    onAddQuery={this.props.onAddQuery}
                    onRunQuery={this.props.onRunQueries}
                    queries={queries}
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
