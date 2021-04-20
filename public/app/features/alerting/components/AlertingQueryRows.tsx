import React, { PureComponent } from 'react';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';
import { DataSourceApi, DataSourceInstanceSettings, PanelData, TimeRange } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { QueryEditorRow } from 'app/features/query/components/QueryEditorRow';
import { AlertingQuery } from '../types';
import { ExpressionQuery } from 'app/features/expressions/types';
import { isExpressionQuery } from 'app/features/expressions/guards';

interface Props {
  // The query configuration
  queries: Array<AlertingQuery | ExpressionQuery>;

  // Query editing
  onQueriesChange: (queries: Array<AlertingQuery | ExpressionQuery>) => void;
  onAddQuery: (query: AlertingQuery | ExpressionQuery) => void;
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

  onRemoveQuery = (query: AlertingQuery | ExpressionQuery) => {
    this.props.onQueriesChange(this.props.queries.filter((item) => item !== query));
  };

  onChangeTimeRange(timeRange: TimeRange, query: AlertingQuery, index: number) {
    this.onChangeQuery({ ...query, timeRange }, index);
  }

  onChangeQuery(query: AlertingQuery | ExpressionQuery, index: number) {
    const { queries, onQueriesChange } = this.props;

    onQueriesChange(
      queries.map((item, itemIndex) => {
        if (itemIndex === index) {
          return { ...query };
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

  getDataSourceSettings = (query: ExpressionQuery | AlertingQuery): DataSourceInstanceSettings | undefined => {
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
                {queries.map((query: AlertingQuery | ExpressionQuery, index) => {
                  const data = this.state.dataPerQuery[query.refId];
                  const dsSettings = this.getDataSourceSettings(query);

                  if (!dsSettings) {
                    return null;
                  }

                  if (isExpressionQuery(query)) {
                    return (
                      <QueryEditorRow
                        dsSettings={{ ...dsSettings, meta: { ...dsSettings.meta, mixed: true } }}
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
                    );
                  }

                  return (
                    <QueryEditorRow
                      dsSettings={{ ...dsSettings, meta: { ...dsSettings.meta, mixed: true } }}
                      id={query.refId}
                      index={index}
                      key={query.refId}
                      data={data}
                      query={query}
                      onChange={(query) => this.onChangeQuery(query, index)}
                      timeRange={query.timeRange}
                      onChangeTimeRange={(timeRange) => this.onChangeTimeRange(timeRange, query, index)}
                      onRemoveQuery={this.onRemoveQuery}
                      onAddQuery={this.props.onAddQuery}
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
