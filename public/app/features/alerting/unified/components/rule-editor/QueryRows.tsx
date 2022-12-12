import { omit } from 'lodash';
import memoize from 'memoize-one';
import React, { PureComponent, useState } from 'react';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';

import {
  DataQuery,
  DataSourceInstanceSettings,
  LoadingState,
  PanelData,
  RelativeTimeRange,
  ThresholdsConfig,
  ThresholdsMode,
} from '@grafana/data';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { Button, Card, Icon } from '@grafana/ui';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { Graph, Node } from 'app/core/utils/dag';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { ExpressionQueryType } from 'app/features/expressions/types';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { AlertDataQuery, AlertQuery } from 'app/types/unified-alerting-dto';

import { EmptyQueryWrapper, QueryWrapper } from './QueryWrapper';
import { errorFromSeries } from './util';

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

  getThresholdsForQueries = (queries: AlertQuery[]): Record<string, ThresholdsConfig> => {
    const thresholds: Record<string, ThresholdsConfig> = {};
    const SUPPORTED_EXPRESSION_TYPES = [ExpressionQueryType.threshold, ExpressionQueryType.classic];

    for (const query of queries) {
      if (!isExpressionQuery(query.model)) {
        continue;
      }

      // currently only supporting threshold & classic condition expressions
      if (!SUPPORTED_EXPRESSION_TYPES.includes(query.model.type)) {
        continue;
      }

      if (!Array.isArray(query.model.conditions)) {
        continue;
      }

      query.model.conditions.forEach((condition, index) => {
        const threshold = condition.evaluator.params[0];
        // "classic_conditions" use `condition.query.params[]` and "threshold" uses `query.model.expression` *sigh*
        const refId = condition.query.params[0] ?? query.model.expression;

        // TODO support range thresholds
        if (condition.evaluator.type === 'outside_range' || condition.evaluator.type === 'within_range') {
          return;
        }

        try {
          // 1. create a DAG so we can find the origin of the current expression
          const graph = createDagFromQueries(queries);

          // 2. check if the origin is a data query
          // TODO memoize this
          const originRefID = getOriginOfRefId(refId, graph);
          const originQuery = queries.find((query) => query.refId === originRefID);
          const originIsDataQuery = !isExpressionQuery(originQuery?.model);

          // 3. if yes, add threshold config to the refId of the data Query
          if (originIsDataQuery && originRefID) {
            appendThreshold(originRefID, threshold);
          }
        } catch (err) {
          return;
        }

        function appendThreshold(originRefID: string, value: number) {
          if (!thresholds[originRefID]) {
            thresholds[originRefID] = {
              mode: ThresholdsMode.Absolute,
              steps: [
                {
                  value: -Infinity,
                  color: config.theme2.colors.success.main,
                },
              ],
            };
          }

          thresholds[originRefID].steps.push({
            value: value,
            color: config.theme2.colors.error.main,
          });
        }
      });
    }

    return thresholds;
  };

  render() {
    const { queries, expressions } = this.props;
    const thresholdByRefId = this.getThresholdsForQueries([...queries, ...expressions]);

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
                      thresholds={thresholdByRefId[query.refId]}
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

// TODO maybe move this to the DAG util?
function getOriginOfRefId(refId: string, graph: Graph): string | undefined {
  const node = graph.getNode(refId);

  let origin: Node | undefined;

  // recurse through "node > inputEdges > inputNode"
  function findChildNode(node: Node) {
    const inputEdges = node.inputEdges;

    // if we still have input edges, keep looking
    if (inputEdges.length > 0) {
      // check each edge for input nodes
      inputEdges.forEach((edge) => {
        // if the edge still has a child node, keep looking
        if (edge.inputNode) {
          findChildNode(edge.inputNode);
        }
      });
    } else {
      // if we have no more input edges it means we we've found our origin
      origin = node;
    }
  }

  findChildNode(node);

  return origin?.name;
}

// memoized version of _createDagFromQueries to prevent recreating the DAG if no sources or targets are modified
const createDagFromQueries = memoize(
  _createDagFromQueries,
  (previous: Parameters<typeof _createDagFromQueries>, next: Parameters<typeof _createDagFromQueries>) => {
    return fingerPrintQueries(previous[0]) === fingerPrintQueries(next[0]);
  }
);

function fingerPrintQueries(queries: AlertQuery[]) {
  return queries.map((query) => query.refId + query.model.expression).join();
}

/**
 * Turn the array of alert queries (this means data queries and expressions)
 * in to a DAG, a directed acyclical graph
 */
function _createDagFromQueries(queries: AlertQuery[]): Graph {
  const graph = new Graph();

  queries.forEach((query) => {
    const source = query.refId;
    const target = query.model.expression;
    const isSelf = source === target;

    if (!graph.getNode(source)) {
      graph.createNode(source);
    }

    if (source && target && !isSelf) {
      graph.link(target, source);
    }
  });

  return graph;
}
