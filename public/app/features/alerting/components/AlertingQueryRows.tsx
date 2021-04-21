import React, { PureComponent } from 'react';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';
import { DataQuery, DataSourceApi, DataSourceInstanceSettings, rangeUtil, PanelData, TimeRange } from '@grafana/data';
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
  defaultDataSource: DataSourceApi;
}

export class AlertingQueryRows extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { dataPerQuery: {}, defaultDataSource: {} as DataSourceApi };
  }

  async componentDidMount() {
    const defaultDataSource = await getDataSourceSrv().get();
    this.setState({ defaultDataSource });
  }

  onRemoveQuery = (query: DataQuery) => {
    this.props.onQueriesChange(this.props.queries.filter((item) => item.model !== query));
  };

  onChangeTimeRange(timeRange: TimeRange, index: number) {
    const { queries, onQueriesChange } = this.props;
    onQueriesChange(
      queries.map((item, itemIndex) => {
        if (itemIndex === index) {
          return { ...item, relativeTimeRange: rangeUtil.timeRangeToRelative(timeRange) };
        }
        return item;
      })
    );
  }

  onChangeQuery(query: DataQuery, index: number) {
    const { queries, onQueriesChange } = this.props;
    onQueriesChange(
      queries.map((item, itemIndex) => {
        if (itemIndex === index) {
          return { ...item, model: { ...item.model, ...query, datasource: query.datasource! } };
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

  getDataSourceSettings = (query: DataQuery): DataSourceInstanceSettings | undefined => {
    const { defaultDataSource } = this.state;

    if (isExpressionQuery(query)) {
      return getDataSourceSrv().getInstanceSettings(defaultDataSource.name);
    }

    return getDataSourceSrv().getInstanceSettings(query.datasource);
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
                      dsSettings={{ ...dsSettings, meta: { ...dsSettings.meta, mixed: true } }}
                      id={query.refId}
                      index={index}
                      key={query.refId}
                      data={data}
                      query={query.model}
                      onChange={(query) => this.onChangeQuery(query, index)}
                      timeRange={
                        !isExpressionQuery(query.model)
                          ? rangeUtil.relativeToTimeRange(query.relativeTimeRange)
                          : undefined
                      }
                      onChangeTimeRange={
                        !isExpressionQuery(query.model)
                          ? (timeRange) => this.onChangeTimeRange(timeRange, index)
                          : undefined
                      }
                      onRemoveQuery={this.onRemoveQuery}
                      onAddQuery={this.props.onDuplicateQuery}
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
