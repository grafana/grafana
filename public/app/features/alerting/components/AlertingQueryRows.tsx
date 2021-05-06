import React, { PureComponent } from 'react';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';
import { DataQuery, DataSourceInstanceSettings, rangeUtil, PanelData, TimeRange } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { QueryEditorRow } from 'app/features/query/components/QueryEditorRow';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { GrafanaQuery } from 'app/types/unified-alerting-dto';

interface Props {
  // The query configuration
  queries: GrafanaQuery[];

  // Query editing
  onQueriesChange: (queries: GrafanaQuery[]) => void;
  onDuplicateQuery: (query: GrafanaQuery) => void;
  onRunQueries: () => void;
}

interface State {
  dataPerQuery: Record<string, PanelData>;
}

export class AlertingQueryRows extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { dataPerQuery: {} };
  }

  onRemoveQuery = (query: DataQuery) => {
    this.props.onQueriesChange(this.props.queries.filter((item) => item.model !== query));
  };

  onChangeTimeRange(timeRange: TimeRange, index: number) {
    const { queries, onQueriesChange } = this.props;
    onQueriesChange(
      queries.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }
        return {
          ...item,
          relativeTimeRange: rangeUtil.timeRangeToRelative(timeRange),
        };
      })
    );
  }

  onChangeDataSource(settings: DataSourceInstanceSettings, index: number) {
    const { queries, onQueriesChange } = this.props;

    onQueriesChange(
      queries.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const previous = getDataSourceSrv().getInstanceSettings(item.datasourceUid);

        if (previous?.type === settings.uid) {
          return {
            ...item,
            datasourceUid: settings.uid,
          };
        }

        const { refId, hide } = item.model;

        return {
          ...item,
          datasourceUid: settings.uid,
          model: { refId, hide },
        };
      })
    );
  }

  onChangeQuery(query: DataQuery, index: number) {
    const { queries, onQueriesChange } = this.props;

    onQueriesChange(
      queries.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }
        return {
          ...item,
          model: {
            ...item.model,
            ...query,
            datasource: query.datasource!,
          },
        };
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

  onDuplicateQuery = (query: DataQuery, source: GrafanaQuery): void => {
    this.props.onDuplicateQuery({
      ...source,
      model: query,
    });
  };

  getDataSourceSettings = (query: GrafanaQuery): DataSourceInstanceSettings | undefined => {
    return getDataSourceSrv().getInstanceSettings(query.datasourceUid);
  };

  render() {
    const { queries } = this.props;

    return (
      <DragDropContext onDragEnd={this.onDragEnd}>
        <Droppable droppableId="alerting-queries" direction="vertical">
          {(provided) => {
            return (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {queries.map((query: GrafanaQuery, index) => {
                  const data = this.state.dataPerQuery[query.refId];
                  const dsSettings = this.getDataSourceSettings(query);

                  if (!dsSettings) {
                    return null;
                  }

                  return (
                    <QueryEditorRow
                      dataSource={dsSettings}
                      onChangeDataSource={
                        !isExpressionQuery(query.model)
                          ? (settings) => this.onChangeDataSource(settings, index)
                          : undefined
                      }
                      id={query.refId}
                      index={index}
                      key={query.refId}
                      data={data}
                      query={query.model}
                      onChange={(query) => this.onChangeQuery(query, index)}
                      timeRange={
                        !isExpressionQuery(query.model) && query.relativeTimeRange
                          ? rangeUtil.relativeToTimeRange(query.relativeTimeRange)
                          : undefined
                      }
                      onChangeTimeRange={
                        !isExpressionQuery(query.model)
                          ? (timeRange) => this.onChangeTimeRange(timeRange, index)
                          : undefined
                      }
                      onRemoveQuery={this.onRemoveQuery}
                      onAddQuery={(duplicate) => this.onDuplicateQuery(duplicate, query)}
                      onRunQuery={this.props.onRunQueries}
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
