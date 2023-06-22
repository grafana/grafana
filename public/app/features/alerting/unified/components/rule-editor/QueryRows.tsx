import { omit } from 'lodash';
import React, { PureComponent, useState } from 'react';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';

import { DataQuery, DataSourceInstanceSettings, LoadingState, PanelData, RelativeTimeRange } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { getDataSourceSrv } from '@grafana/runtime';
import { Button, Card, Icon } from '@grafana/ui';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { AlertDataQuery, AlertQuery } from 'app/types/unified-alerting-dto';

import { AlertQueryOptions, EmptyQueryWrapper, QueryWrapper } from './QueryWrapper';
import { errorFromSeries, getThresholdsForQueries } from './util';

interface Props {
  // The query configuration
  queries: AlertQuery[];
  expressions: AlertQuery[];
  data: Record<string, PanelData>;
  onRunQueries: () => void;

  // Query editing
  onQueriesChange: (queries: AlertQuery[]) => void;
  onDuplicateQuery: (query: AlertQuery) => void;
  condition: string | null;
  onSetCondition: (refId: string) => void;
}

export class QueryRows extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
  }

  onRemoveQuery = (query: DataQuery) => {
    const { queries, onQueriesChange } = this.props;
    onQueriesChange(queries.filter((q) => q.refId !== query.refId));
  };

  onChangeTimeRange = (timeRange: RelativeTimeRange, index: number) => {
    const { queries, onQueriesChange } = this.props;
    onQueriesChange(
      queries.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }
        return {
          ...item,
          relativeTimeRange: timeRange,
        };
      })
    );
  };

  onChangeQueryOptions = (options: AlertQueryOptions, index: number) => {
    const { queries, onQueriesChange } = this.props;
    onQueriesChange(
      queries.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }
        return {
          ...item,
          model: { ...item.model, maxDataPoints: options.maxDataPoints },
        };
      })
    );
  };

  onChangeDataSource = (settings: DataSourceInstanceSettings, index: number) => {
    const { queries, onQueriesChange } = this.props;

    const updatedQueries = queries.map((item, itemIndex) => {
      if (itemIndex !== index) {
        return item;
      }

      const previousSettings = this.getDataSourceSettings(item);

      // Copy model if changing to a datasource of same type.
      if (settings.type === previousSettings?.type) {
        return copyModel(item, settings);
      }
      return newModel(item, settings);
    });

    onQueriesChange(updatedQueries);
  };

  onChangeQuery = (query: DataQuery, index: number) => {
    const { queries, onQueriesChange } = this.props;

    onQueriesChange(
      queries.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        return {
          ...item,
          refId: query.refId,
          queryType: item.model.queryType ?? '',
          model: {
            ...item.model,
            ...query,
            datasource: query.datasource!,
          },
        };
      })
    );
  };

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

  getDataSourceSettings = (query: AlertQuery): DataSourceInstanceSettings | undefined => {
    return getDataSourceSrv().getInstanceSettings(query.datasourceUid);
  };

  render() {
    const { queries, expressions } = this.props;
    const thresholdByRefId = getThresholdsForQueries([...queries, ...expressions]);

    return (
      <DragDropContext onDragEnd={this.onDragEnd}>
        <Droppable droppableId="alerting-queries" direction="vertical">
          {(provided) => {
            return (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                <Stack direction="column">
                  {queries.map((query, index) => {
                    const data: PanelData = this.props.data?.[query.refId] ?? {
                      series: [],
                      state: LoadingState.NotStarted,
                    };
                    const dsSettings = this.getDataSourceSettings(query);

                    const isAlertCondition = this.props.condition === query.refId;
                    const error = isAlertCondition ? errorFromSeries(data.series) : undefined;

                    if (!dsSettings) {
                      return (
                        <DatasourceNotFound
                          key={`${query.refId}-${index}`}
                          index={index}
                          model={query.model}
                          onUpdateDatasource={() => {
                            const defaultDataSource = getDatasourceSrv().getInstanceSettings(null);
                            if (defaultDataSource) {
                              this.onChangeDataSource(defaultDataSource, index);
                            }
                          }}
                          onRemoveQuery={() => {
                            this.onRemoveQuery(query);
                          }}
                        />
                      );
                    }

                    return (
                      <QueryWrapper
                        index={index}
                        key={query.refId}
                        dsSettings={dsSettings}
                        data={data}
                        error={error}
                        query={query}
                        onChangeQuery={this.onChangeQuery}
                        onRemoveQuery={this.onRemoveQuery}
                        queries={[...queries, ...expressions]}
                        onChangeDataSource={this.onChangeDataSource}
                        onDuplicateQuery={this.props.onDuplicateQuery}
                        onChangeTimeRange={this.onChangeTimeRange}
                        onChangeQueryOptions={this.onChangeQueryOptions}
                        thresholds={thresholdByRefId[query.refId]?.config}
                        thresholdsType={thresholdByRefId[query.refId]?.mode}
                        onRunQueries={this.props.onRunQueries}
                        condition={this.props.condition}
                        onSetCondition={this.props.onSetCondition}
                      />
                    );
                  })}
                  {provided.placeholder}
                </Stack>
              </div>
            );
          }}
        </Droppable>
      </DragDropContext>
    );
  }
}

function copyModel(item: AlertQuery, settings: DataSourceInstanceSettings): Omit<AlertQuery, 'datasource'> {
  return {
    ...item,
    model: {
      ...omit(item.model, 'datasource'),
      datasource: {
        type: settings.type,
        uid: settings.uid,
      },
    },
    datasourceUid: settings.uid,
  };
}

function newModel(item: AlertQuery, settings: DataSourceInstanceSettings): Omit<AlertQuery, 'datasource'> {
  return {
    refId: item.refId,
    relativeTimeRange: item.relativeTimeRange,
    queryType: '',
    datasourceUid: settings.uid,
    model: {
      refId: item.refId,
      hide: false,
      datasource: {
        type: settings.type,
        uid: settings.uid,
      },
    },
  };
}

interface DatasourceNotFoundProps {
  index: number;
  model: AlertDataQuery;
  onUpdateDatasource: () => void;
  onRemoveQuery: () => void;
}

const DatasourceNotFound = ({ index, onUpdateDatasource, onRemoveQuery, model }: DatasourceNotFoundProps) => {
  const refId = model.refId;

  const [showDetails, setShowDetails] = useState<boolean>(false);

  const toggleDetails = () => {
    setShowDetails((show) => !show);
  };

  const handleUpdateDatasource = () => {
    onUpdateDatasource();
  };

  return (
    <EmptyQueryWrapper>
      <QueryOperationRow title={refId} draggable index={index} id={refId} isOpen collapsable={false}>
        <Card>
          <Card.Heading>This datasource has been removed</Card.Heading>
          <Card.Description>
            The datasource for this query was not found, it was either removed or is not installed correctly.
          </Card.Description>
          <Card.Figure>
            <Icon name="question-circle" />
          </Card.Figure>
          <Card.Actions>
            <Button key="update" variant="secondary" onClick={handleUpdateDatasource}>
              Update datasource
            </Button>
            <Button key="remove" variant="destructive" onClick={onRemoveQuery}>
              Remove query
            </Button>
          </Card.Actions>
          <Card.SecondaryActions>
            <Button
              key="details"
              onClick={toggleDetails}
              icon={showDetails ? 'angle-up' : 'angle-down'}
              fill="text"
              size="sm"
            >
              Show details
            </Button>
          </Card.SecondaryActions>
        </Card>
        {showDetails && (
          <div>
            <pre>
              <code>{JSON.stringify(model, null, 2)}</code>
            </pre>
          </div>
        )}
      </QueryOperationRow>
    </EmptyQueryWrapper>
  );
};
