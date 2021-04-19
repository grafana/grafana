import React, { PureComponent } from 'react';
import { Unsubscribable } from 'rxjs';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';
import { DataSourceApi, DataSourceInstanceSettings, DataQuery, PanelData, TimeRange } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { QueryEditorRow } from 'app/features/query/components/QueryEditorRow';
import { MultiQueryRunner } from '../state/MultiQueryRunner';
import { ExpressionDatasourceID } from '../../expressions/ExpressionDatasource';

interface Props {
  // The query configuration
  queryRunner: MultiQueryRunner;
  queries: DataQuery[];

  // Query editing
  onQueriesChange: (queries: DataQuery[]) => void;
  onAddQuery: (query: DataQuery) => void;
  onRunQueries: () => void;
}

interface State {
  dataPerQuery: Record<string, PanelData>;
  defaultDataSource: DataSourceApi;
}

export class AlertingQueryRows extends PureComponent<Props, State> {
  querySubscription: Unsubscribable | null;

  constructor(props: Props) {
    super(props);
    this.state = { dataPerQuery: {}, defaultDataSource: {} as DataSourceApi };
  }

  async componentDidMount() {
    this.querySubscription = this.props.queryRunner.getData().subscribe((data) => {
      console.log('data', data);
      this.setState({ dataPerQuery: data });
    });

    const defaultDataSource = await getDataSourceSrv().get();
    this.setState({ defaultDataSource });
  }

  componentWillUnmount() {
    if (this.querySubscription) {
      this.querySubscription.unsubscribe();
    }
  }

  onRemoveQuery = (query: DataQuery) => {
    this.props.onQueriesChange(this.props.queries.filter((item) => item !== query));
  };

  onChangeTimeRange(timeRange: TimeRange, query: DataQuery, index: number) {
    this.onChangeQuery({ ...query, timeRange }, index);
  }

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
    const { queries } = this.props;
    const { defaultDataSource } = this.state;

    return (
      <DragDropContext onDragEnd={this.onDragEnd}>
        <Droppable droppableId="transformations-list" direction="vertical">
          {(provided) => {
            return (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {queries.map((query, index) => {
                  let dsSettings: DataSourceInstanceSettings;
                  if (query.datasource === ExpressionDatasourceID) {
                    dsSettings = getDataSourceSrv().getInstanceSettings(defaultDataSource.name)!;
                  } else {
                    dsSettings = getDataSourceSrv().getInstanceSettings(query.datasource)!;
                  }
                  const data = this.state.dataPerQuery[query.refId];
                  console.log(dsSettings);
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
