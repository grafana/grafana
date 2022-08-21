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
  ThresholdsMode,
} from '@grafana/data';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { Button, Card, Icon } from '@grafana/ui';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { AlertDataQuery, AlertQuery } from 'app/types/unified-alerting-dto';

import { SavedQueryLink } from '../../../../dashboard/state/PanelModel';
import { getSavedQuerySrv } from '../../../../query-library/api/SavedQueriesSrv';
import { SavedQueryPicker } from '../../../../query/components/SavedQueryPicker';

import { EmptyQueryWrapper, QueryWrapper } from './QueryWrapper';
import { queriesWithUpdatedReferences } from './util';

interface Props {
  // The query configuration
  queries: AlertQuery[];
  data: Record<string, PanelData>;
  savedQueryLink: SavedQueryLink | null;

  // Query editing
  onQueriesChange: (queries: AlertQuery[], savedQueryLink: SavedQueryLink | null) => void;
  onDuplicateQuery: (query: AlertQuery) => void;
  onRunQueries: () => void;
}

interface State {
  savedQueryLink: SavedQueryLink | null;
  dataPerQuery: Record<string, PanelData>;
}

export class QueryRows extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = { dataPerQuery: {}, savedQueryLink: this.props.savedQueryLink };
  }

  onRemoveQuery = (query: DataQuery) => {
    this.props.onQueriesChange(
      this.props.queries.filter((item) => {
        return item.model.refId !== query.refId;
      }),
      this.state.savedQueryLink
    );
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
      }),
      this.state.savedQueryLink
    );
  };

  onSelectedSaveQuery = async (uid: string | null) => {
    if (!uid?.length) {
      return;
    }

    const { onQueriesChange } = this.props;

    const resp = await getSavedQuerySrv().getSavedQueryByUids([{ uid: uid }]);
    if (!resp?.length) {
      throw new Error('TODO error handling');
    }
    const savedQuery = resp[0];

    onQueriesChange(
      savedQuery.queries.map((savedQ) => ({
        ...savedQ,
        relativeTimeRange: {
          // use now-15m as default
          from: 900,
          to: 0,
        },
        datasourceUid: savedQ.datasource?.uid ?? '-100',
        model: savedQ,
        queryType: savedQ.datasource?.uid ? 'query' : 'expression',
      })),
      { ref: { uid }, variables: [] }
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
      }),
      this.state.savedQueryLink
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
    onQueriesChange(updatedQueries, this.state.savedQueryLink);
  };

  onChangeQuery = (query: DataQuery, index: number) => {
    const { queries, onQueriesChange } = this.props;

    // find what queries still have a reference to the old name
    const previousRefId = queries[index].refId;
    const newRefId = query.refId;

    onQueriesChange(
      queriesWithUpdatedReferences(queries, previousRefId, newRefId).map((item, itemIndex) => {
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
      }),
      this.state.savedQueryLink
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
    onQueriesChange(update, this.state.savedQueryLink);
  };

  onDuplicateQuery = (query: DataQuery, source: AlertQuery): void => {
    this.props.onDuplicateQuery({
      ...source,
      model: query,
    });
  };

  getDataSourceSettings = (query: AlertQuery): DataSourceInstanceSettings | undefined => {
    return getDataSourceSrv().getInstanceSettings(query.datasourceUid);
  };

  getThresholdsForQueries = (queries: AlertQuery[]): Record<string, ThresholdsConfig> => {
    const record: Record<string, ThresholdsConfig> = {};

    for (const query of queries) {
      if (!isExpressionQuery(query.model)) {
        continue;
      }

      if (!Array.isArray(query.model.conditions)) {
        continue;
      }

      query.model.conditions.forEach((condition, index) => {
        if (index > 0) {
          return;
        }
        const threshold = condition.evaluator.params[0];
        const refId = condition.query.params[0];

        if (condition.evaluator.type === 'outside_range' || condition.evaluator.type === 'within_range') {
          return;
        }
        if (!record[refId]) {
          record[refId] = {
            mode: ThresholdsMode.Absolute,
            steps: [
              {
                value: -Infinity,
                color: config.theme2.colors.success.main,
              },
            ],
          };
        }

        record[refId].steps.push({
          value: threshold,
          color: config.theme2.colors.error.main,
        });
      });
    }

    return record;
  };

  render() {
    const { onDuplicateQuery, onRunQueries, queries } = this.props;
    const thresholdByRefId = this.getThresholdsForQueries(queries);

    return (
      <div style={{ maxWidth: '750px' }}>
        TODO: Implement filtering based on datasource alerting capabilities :)
        {/*// @ts-ignore*/}
        <SavedQueryPicker onChange={this.onSelectedSaveQuery} current={this.state.savedQueryLink?.ref?.uid} />
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
                        query={query}
                        onChangeQuery={this.onChangeQuery}
                        onRemoveQuery={this.onRemoveQuery}
                        queries={queries}
                        onChangeDataSource={this.onChangeDataSource}
                        onDuplicateQuery={onDuplicateQuery}
                        onRunQueries={onRunQueries}
                        onChangeTimeRange={this.onChangeTimeRange}
                        thresholds={thresholdByRefId[query.refId]}
                        onChangeThreshold={this.onChangeThreshold}
                      />
                    );
                  })}
                  {provided.placeholder}
                </div>
              );
            }}
          </Droppable>
        </DragDropContext>
      </div>
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
