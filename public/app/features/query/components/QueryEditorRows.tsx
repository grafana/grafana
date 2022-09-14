import React, { PureComponent } from 'react';
import { DragDropContext, DragStart, Droppable, DropResult } from 'react-beautiful-dnd';

import {
  CoreApp,
  DataQuery,
  DataSourceInstanceSettings,
  DataSourceRef,
  EventBusExtended,
  HistoryItem,
  PanelData,
} from '@grafana/data';
import { getDataSourceSrv, reportInteraction } from '@grafana/runtime';

import { QueryEditorRow } from './QueryEditorRow';

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

  // Misc
  app?: CoreApp;
  history?: Array<HistoryItem<DataQuery>>;
  eventBus?: EventBusExtended;

  onDatasourceChange?: (dataSource: DataSourceInstanceSettings, query: DataQuery) => void;
}

export class QueryEditorRows extends PureComponent<Props> {
  onRemoveQuery = (query: DataQuery) => {
    this.props.onQueriesChange(this.props.queries.filter((item) => item !== query));
  };

  onChangeQuery(query: DataQuery, index: number) {
    const { queries, onQueriesChange } = this.props;

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

  onDataSourceChange(dataSource: DataSourceInstanceSettings, index: number) {
    const { queries, onQueriesChange } = this.props;

    if (this.props.onDatasourceChange) {
      this.props.onDatasourceChange(dataSource, queries[index]);
    }

    onQueriesChange(
      queries.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const dataSourceRef: DataSourceRef = {
          type: dataSource.type,
          uid: dataSource.uid,
        };

        if (item.datasource) {
          const previous = getDataSourceSrv().getInstanceSettings(item.datasource);

          if (previous?.type === dataSource.type) {
            return {
              ...item,
              datasource: dataSourceRef,
            };
          }
        }

        return {
          refId: item.refId,
          hide: item.hide,
          datasource: dataSourceRef,
        };
      })
    );
  }

  onDragStart = (result: DragStart) => {
    const { queries, dsSettings } = this.props;

    reportInteraction('query_row_reorder_started', {
      startIndex: result.source.index,
      numberOfQueries: queries.length,
      datasourceType: dsSettings.type,
    });
  };

  onDragEnd = (result: DropResult) => {
    const { queries, onQueriesChange, dsSettings } = this.props;

    if (!result || !result.destination) {
      return;
    }

    const startIndex = result.source.index;
    const endIndex = result.destination.index;
    if (startIndex === endIndex) {
      reportInteraction('query_row_reorder_canceled', {
        startIndex,
        endIndex,
        numberOfQueries: queries.length,
        datasourceType: dsSettings.type,
      });
      return;
    }

    const update = Array.from(queries);
    const [removed] = update.splice(startIndex, 1);
    update.splice(endIndex, 0, removed);
    onQueriesChange(update);

    reportInteraction('query_row_reorder_ended', {
      startIndex,
      endIndex,
      numberOfQueries: queries.length,
      datasourceType: dsSettings.type,
    });
  };

  render() {
    const { dsSettings, data, queries, app, history, eventBus } = this.props;

    return (
      <DragDropContext onDragStart={this.onDragStart} onDragEnd={this.onDragEnd}>
        <Droppable droppableId="transformations-list" direction="vertical">
          {(provided) => {
            return (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {queries.map((query, index) => {
                  const dataSourceSettings = getDataSourceSettings(query, dsSettings);
                  const onChangeDataSourceSettings = dsSettings.meta.mixed
                    ? (settings: DataSourceInstanceSettings) => this.onDataSourceChange(settings, index)
                    : undefined;

                  return (
                    <QueryEditorRow
                      id={query.refId}
                      index={index}
                      key={query.refId}
                      data={data}
                      query={query}
                      dataSource={dataSourceSettings}
                      onChangeDataSource={onChangeDataSourceSettings}
                      onChange={(query) => this.onChangeQuery(query, index)}
                      onRemoveQuery={this.onRemoveQuery}
                      onAddQuery={this.props.onAddQuery}
                      onRunQuery={this.props.onRunQueries}
                      queries={queries}
                      app={app}
                      history={history}
                      eventBus={eventBus}
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

const getDataSourceSettings = (
  query: DataQuery,
  groupSettings: DataSourceInstanceSettings
): DataSourceInstanceSettings => {
  if (!query.datasource) {
    return groupSettings;
  }
  const querySettings = getDataSourceSrv().getInstanceSettings(query.datasource);
  return querySettings || groupSettings;
};
