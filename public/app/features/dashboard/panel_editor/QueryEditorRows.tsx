// Libraries
import React, { PureComponent } from 'react';

// Types
import { PanelModel } from '../state/PanelModel';
import { DataQuery, PanelData, DataSourceSelectItem } from '@grafana/data';
import { DashboardModel } from '../state/DashboardModel';
import { QueryEditorRow } from './QueryEditorRow';
import { addQuery } from 'app/core/utils/query';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';

interface Props {
  // The query configuration
  queries: DataQuery[];
  datasource: DataSourceSelectItem;

  // Query editing
  onChangeQueries: (queries: DataQuery[]) => void;
  onScrollBottom: () => void;

  // Dashboard Configs
  panel: PanelModel;
  dashboard: DashboardModel;

  // Query Response Data
  data: PanelData;
}

export class QueryEditorRows extends PureComponent<Props> {
  onAddQuery = (query?: Partial<DataQuery>) => {
    const { queries, onChangeQueries } = this.props;
    onChangeQueries(addQuery(queries, query));
    this.props.onScrollBottom();
  };

  onRemoveQuery = (query: DataQuery) => {
    const { queries, onChangeQueries, panel } = this.props;
    const removed = queries.filter(q => {
      return q !== query;
    });
    onChangeQueries(removed);
    panel.refresh();
  };

  onChangeQuery = (query: DataQuery) => {
    const { queries, onChangeQueries } = this.props;

    // Assuming datasources won't mutate queries, we find the index of the query that was updated.
    const prevQueryIndex = queries.findIndex((_, i, oldQueries) => oldQueries[i] !== queries[i]);

    onChangeQueries(
      queries.map((item, itemIndex) => {
        if (itemIndex === prevQueryIndex) {
          // ensure refId & datasource are maintained
          return {
            ...query,
            refId: queries[prevQueryIndex].refId,
            datasource: queries[prevQueryIndex].datasource,
          };
        }
        return item;
      })
    );
  };

  onDragEnd = (result: DropResult) => {
    const { queries, onChangeQueries, panel } = this.props;

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
    onChangeQueries(update);
    panel.refresh();
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
                    panel={props.panel}
                    dashboard={props.dashboard}
                    data={props.data}
                    query={query}
                    onChange={this.onChangeQuery}
                    onRemoveQuery={this.onRemoveQuery}
                    onAddQuery={this.onAddQuery}
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
