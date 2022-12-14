import { omit } from 'lodash';
import React, { PureComponent, useState } from 'react';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';

import {
  DataQuery,
  DataSourceInstanceSettings,
  LoadingState,
  PanelData,
  RelativeTimeRange,
  ThresholdsConfig,
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { Button, Card, Icon } from '@grafana/ui';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { AlertDataQuery, AlertQuery } from 'app/types/unified-alerting-dto';

import { EmptyQueryWrapper, QueryWrapper } from './QueryWrapper';
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

  onChangeThreshold = (thresholds: ThresholdsConfig, index: number) => {
    const { queries, onQueriesChange } = this.props;

    const referencedRefId = queries[index].refId;

    onQueriesChange(
      queries.map((query) => {
        if (!isExpressionQuery(query.model)) {
          return query;
        }

        if (query.model.conditions && query.model.conditions[0].query.params[0] === referencedRefId) {
          return {
            ...query,
            model: {
              ...query.model,
              conditions: query.model.conditions.map((condition, conditionIndex) => {
                // Only update the first condition for a given refId.
                if (condition.query.params[0] === referencedRefId && conditionIndex === 0) {
                  return {
                    ...condition,
                    evaluator: {
                      ...condition.evaluator,
                      params: [parseFloat(thresholds.steps[1].value.toPrecision(3))],
                    },
                  };
                }
                return condition;
              }),
            },
          };
        }
        return query;
      })
    );
  };

  onChangeDataSource = (settings: DataSourceInstanceSettings, index: number) => {
    const { queries, onQueriesChange } = this.props;

    const updatedQueries = queries.map((item, itemIndex) => {
      if (itemIndex !== index) {
        return item;
      }

      return copyModel(item, settings.uid);
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
                      queries={queries}
                      onChangeDataSource={this.onChangeDataSource}
                      onDuplicateQuery={this.props.onDuplicateQuery}
                      onChangeTimeRange={this.onChangeTimeRange}
                      thresholds={thresholdByRefId[query.refId]?.config}
                      thresholdsType={thresholdByRefId[query.refId]?.mode}
                      onChangeThreshold={this.onChangeThreshold}
                      onRunQueries={this.props.onRunQueries}
                      condition={this.props.condition}
                      onSetCondition={this.props.onSetCondition}
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

function copyModel(item: AlertQuery, uid: string): Omit<AlertQuery, 'datasource'> {
  return {
    ...item,
    model: omit(item.model, 'datasource'),
    datasourceUid: uid,
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
      <QueryOperationRow title={refId} draggable index={index} id={refId} isOpen>
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
