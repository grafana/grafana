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

  onChangeQuery(query: DataQuery, index: number) {
    const { queries, onChangeQueries } = this.props;

    const old = queries[index];

    // ensure refId & datasource are maintained
    query.refId = old.refId;
    if (old.datasource) {
      query.datasource = old.datasource;
    }

    // update query in array
    onChangeQueries(
      queries.map((item, itemIndex) => {
        if (itemIndex === index) {
          return query;
        }
        return item;
      })
    );
  }

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
                    onChange={query => this.onChangeQuery(query, index)}
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
