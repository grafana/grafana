import { DragDropContext, DropResult, Droppable } from '@hello-pangea/dnd';
import { omit } from 'lodash';
import { PureComponent, useState } from 'react';

import {
  DataSourceApi,
  DataSourceInstanceSettings,
  LoadingState,
  PanelData,
  RelativeTimeRange,
  getDataSourceRef,
  rangeUtil,
} from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Button, Card, Icon, Stack } from '@grafana/ui';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { SortOrder, getRichHistory } from 'app/core/utils/richHistory';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { SparkJoySection } from 'app/features/query/components/SparkJoySection';
import { RichHistoryQuery } from 'app/types/explore';
import { AlertDataQuery, AlertQuery } from 'app/types/unified-alerting-dto';

import { getInstantFromDataQuery } from '../../utils/rule-form';

import { AlertQueryOptions, EmptyQueryWrapper, QueryWrapper } from './QueryWrapper';
import { errorFromCurrentCondition, errorFromPreviewData, getThresholdsForQueries } from './util';

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
  
  // SparkJoy support
  sparkJoy?: boolean;
}

export class QueryRows extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
  }
  
  state = {
    recentQueries: [] as RichHistoryQuery[],
    isLoadingHistory: false,
    datasourceInstances: {} as Record<string, DataSourceApi>,
  };
  
  async componentDidMount() {
    // Load recent queries for SparkJoy section
    if (this.props.sparkJoy) {
      this.loadRecentQueries();
      this.loadDatasourceInstances();
    }
  }
  
  componentDidUpdate(prevProps: Props) {
    // Reload datasource instances if queries changed
    if (this.props.sparkJoy && prevProps.queries !== this.props.queries) {
      this.loadDatasourceInstances();
    }
  }
  
  loadDatasourceInstances = async () => {
    const { queries } = this.props;
    const instances: Record<string, DataSourceApi> = { ...this.state.datasourceInstances };
    
    for (const query of queries) {
      if (query.datasourceUid && !instances[query.datasourceUid]) {
        try {
          instances[query.datasourceUid] = await getDataSourceSrv().get(query.datasourceUid);
        } catch (error) {
          console.error('Failed to load datasource:', query.datasourceUid, error);
        }
      }
    }
    
    this.setState({ datasourceInstances: instances });
  };
  
  loadRecentQueries = async () => {
    this.setState({ isLoadingHistory: true });
    try {
      // Create default filters for recent queries
      const filters = {
        search: '',
        sortOrder: SortOrder.Descending,
        datasourceFilters: [],
        from: 0,
        to: 7, // Last 7 days
        starred: false,
        page: 1,
      };
      const richHistoryResults = await getRichHistory(filters);
      // Get the most recent 10 queries
      const recentQueries = richHistoryResults.richHistory.slice(0, 10);
      this.setState({ recentQueries, isLoadingHistory: false });
    } catch (error) {
      console.error('Failed to load recent queries:', error);
      this.setState({ isLoadingHistory: false });
    }
  };

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
          model: {
            ...item.model,
            maxDataPoints: options.maxDataPoints,
            intervalMs: options.minInterval ? rangeUtil.intervalToMs(options.minInterval) : undefined,
          },
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
    const { queries, expressions, condition } = this.props;
    const thresholdByRefId = getThresholdsForQueries([...queries, ...expressions], condition);

    return (
      <DragDropContext onDragEnd={this.onDragEnd}>
        <Droppable droppableId="alerting-queries" direction="vertical">
          {(provided) => {
            return (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                <Stack direction="column">
                  {queries.map((query, index) => {
                    const isCondition = this.props.condition === query.refId;
                    const data: PanelData = this.props.data?.[query.refId] ?? {
                      series: [],
                      state: LoadingState.NotStarted,
                    };
                    const dsSettings = this.getDataSourceSettings(query);
                    let error: Error | undefined = undefined;
                    if (data && isCondition) {
                      error = errorFromCurrentCondition(data);
                    } else if (data) {
                      error = errorFromPreviewData(data);
                    }

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

                    // Check if query has expression content
                    const hasExpressionContent = 'expr' in query.model && query.model.expr;
                    const shouldShowSparkJoy = this.props.sparkJoy && index === 0 && queries.length === 1 && !hasExpressionContent;
                    
                    return (
                      <div key={query.refId}>
                        <QueryWrapper
                          index={index}
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
                        {shouldShowSparkJoy && this.state.datasourceInstances[query.datasourceUid] && (
                          <SparkJoySection
                            datasource={this.state.datasourceInstances[query.datasourceUid]}
                            history={this.state.recentQueries}
                            onChangeQuery={(newQuery) => {
                              this.onChangeQuery(newQuery, index);
                            }}
                            onRunQuery={this.props.onRunQueries}
                            isLoadingHistory={this.state.isLoadingHistory}
                            query={query.model}
                          />
                        )}
                      </div>
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
      datasource: getDataSourceRef(settings),
    },
    datasourceUid: settings.uid,
  };
}

function newModel(item: AlertQuery, settings: DataSourceInstanceSettings): Omit<AlertQuery, 'datasource'> {
  const isExpression = isExpressionQuery(item);
  const isInstant = isExpression ? false : getInstantFromDataQuery(item);

  const newQuery: Omit<AlertQuery, 'datasource'> = {
    refId: item.refId,
    relativeTimeRange: item.relativeTimeRange,
    queryType: '',
    datasourceUid: settings.uid,
    model: {
      refId: item.refId,
      hide: false,
      datasource: getDataSourceRef(settings),
    },
  };

  if (isInstant && !isExpressionQuery(item)) {
    (newQuery as AlertQuery<AlertDataQuery>).model.instant = isInstant;
  }

  return newQuery;
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
          <Card.Heading>
            <Trans i18nKey="alerting.datasource-not-found.this-datasource-has-been-removed">
              This datasource has been removed
            </Trans>
          </Card.Heading>
          <Card.Description>
            <Trans i18nKey="alerting.datasource-not-found.card-description">
              The datasource for this query was not found, it was either removed or is not installed correctly.
            </Trans>
          </Card.Description>
          <Card.Figure>
            <Icon name="question-circle" />
          </Card.Figure>
          <Card.Actions>
            <Button key="update" variant="secondary" onClick={handleUpdateDatasource}>
              <Trans i18nKey="alerting.datasource-not-found.update-datasource">Update datasource</Trans>
            </Button>
            <Button key="remove" variant="destructive" onClick={onRemoveQuery}>
              <Trans i18nKey="alerting.datasource-not-found.remove-query">Remove query</Trans>
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
              <Trans i18nKey="alerting.datasource-not-found.show-details">Show details</Trans>
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
