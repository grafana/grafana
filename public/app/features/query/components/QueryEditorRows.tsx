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
  SelectableValue,
} from '@grafana/data';
import { getDataSourceSrv, reportInteraction } from '@grafana/runtime';
import { Button, ValuePicker } from '@grafana/ui';
import {
  ConditionalDataSourceQuery,
  CONDITIONAL_DATASOURCE_NAME,
} from 'app/plugins/datasource/conditional/ConditionalDataSource';
import { ConditionID, conditionsRegistry } from 'app/plugins/datasource/conditional/ConditionsRegistry';

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

  onAddCondition = (index: number, conditionId: ConditionID) => {
    const { queries, onQueriesChange } = this.props;

    const q = queries[index] as ConditionalDataSourceQuery;
    q.conditions = q.conditions
      ? [...q.conditions, { id: conditionId, options: { pattern: 'field name' } }]
      : [{ id: conditionId, options: { pattern: 'field name' } }];

    const nextQueries = [...queries];
    nextQueries[index] = q;

    onQueriesChange(nextQueries);
  };

  onQueryConditionChange = (queryIdx: number, conditionIdx: number) => (options: any) => {
    const { queries, onQueriesChange } = this.props;

    const q = queries[queryIdx] as ConditionalDataSourceQuery;
    q.conditions[conditionIdx].options = options;

    const nextQueries = [...queries];
    nextQueries[queryIdx] = q;

    onQueriesChange(nextQueries);
  };

  renderConditionsEditor(q: ConditionalDataSourceQuery, queryIdx: number) {
    return (
      <>
        {q.conditions?.map((c, i) => {
          const conditionItem = conditionsRegistry.getIfExists(c.id);
          if (!conditionItem) {
            throw new Error('No condition definition for ID ' + c.id);
          }
          const EditorComponent = conditionItem.editor;

          return (
            <div key={i}>
              <EditorComponent onChange={this.onQueryConditionChange(queryIdx, i)} options={c.options} />
            </div>
          );
        })}

        <ValuePicker
          icon="plus"
          label="Add field override"
          variant="secondary"
          menuPlacement="auto"
          isFullWidth={true}
          size="md"
          options={conditionsRegistry
            .list()
            .filter((o) => !o.excludeFromPicker)
            .map<SelectableValue<ConditionID>>((i) => ({
              label: i.name,
              value: i.id as ConditionID,
              description: i.description,
            }))}
          onChange={(value) => this.onAddCondition(queryIdx, value.value!)}
        />
      </>
    );
  }

  render() {
    const { dsSettings, data, queries, app, history, eventBus } = this.props;

    const isConditional = dsSettings.name === CONDITIONAL_DATASOURCE_NAME;

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
                      renderConditionsEditor={
                        isConditional
                          ? () => this.renderConditionsEditor(query as ConditionalDataSourceQuery, index)
                          : undefined
                      }
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
