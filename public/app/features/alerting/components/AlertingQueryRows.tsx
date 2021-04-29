import React, { PureComponent } from 'react';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';
import { css } from '@emotion/css';
import { DataQuery, DataSourceApi, DataSourceInstanceSettings, rangeUtil, PanelData, TimeRange } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { config } from 'app/core/config';
import { QueryEditorRow } from 'app/features/query/components/QueryEditorRow';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { GrafanaQuery } from 'app/types/unified-alerting-dto';
import { VizWrapper } from '../unified/components/rule-editor/VizWrapper';

interface Props {
  // The query configuration
  queries: GrafanaQuery[];
  data: Record<string, PanelData>;

  // Query editing
  onQueriesChange: (queries: GrafanaQuery[]) => void;
  onDuplicateQuery: (query: GrafanaQuery) => void;
  onRunQueries: () => void;
}

interface State {
  defaultDataSource: DataSourceApi;
}

export class AlertingQueryRows extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { defaultDataSource: {} as DataSourceApi };
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
        if (itemIndex !== index) {
          return item;
        }

        const dataSource = getDataSourceSrv().getInstanceSettings(query.datasource);

        if (!dataSource) {
          return item;
        }

        return {
          ...item,
          model: {
            ...item.model,
            ...query,
            datasource: dataSource.name,
            datasourceUid: dataSource.uid,
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
                {queries.map((query, index) => {
                  const data = this.props.data ? this.props.data[query.refId] : ({} as PanelData);
                  const dsSettings = this.getDataSourceSettings(query);
                  const isExpression = isExpressionQuery(query.model);

                  if (!dsSettings) {
                    return null;
                  }

                  return (
                    <div
                      className={css`
                        width: 85%;
                      `}
                      key={`query row - ${query.refId}-${index}`}
                    >
                      <QueryEditorRow
                        dsSettings={{ ...dsSettings, meta: { ...dsSettings.meta, mixed: true } }}
                        id={query.refId}
                        index={index}
                        data={data}
                        query={query.model}
                        onChange={(query) => this.onChangeQuery(query, index)}
                        timeRange={
                          !isExpression && query.relativeTimeRange
                            ? rangeUtil.relativeToTimeRange(query.relativeTimeRange)
                            : undefined
                        }
                        onChangeTimeRange={
                          !isExpression ? (timeRange) => this.onChangeTimeRange(timeRange, index) : undefined
                        }
                        onRemoveQuery={this.onRemoveQuery}
                        onAddQuery={this.props.onDuplicateQuery}
                        onRunQuery={this.props.onRunQueries}
                        queries={queries}
                      />
                      {data && <VizWrapper data={data} defaultPanel={isExpression ? 'table' : 'timeseries'} />}
                    </div>
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
