import { DragDropContext, type DropResult, Droppable } from '@hello-pangea/dnd';
import { omit } from 'lodash';
import { useState } from 'react';

import {
  type DataSourceInstanceSettings,
  LoadingState,
  type PanelData,
  type RelativeTimeRange,
  getDataSourceRef,
  rangeUtil,
} from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';
import { Button, Card, Icon, Stack } from '@grafana/ui';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { type AlertDataQuery, type AlertQuery } from 'app/types/unified-alerting-dto';

import { getInstantFromDataQuery } from '../../utils/rule-form';

import { type AlertQueryOptions, EmptyQueryWrapper, QueryWrapper } from './QueryWrapper';
import {
  type ThresholdDefinition,
  errorFromCurrentCondition,
  errorFromPreviewData,
  getThresholdsForQueries,
} from './util';

function getDataSourceSettings(query: AlertQuery): DataSourceInstanceSettings | undefined {
  return getDataSourceSrv().getInstanceSettings(query.datasourceUid);
}

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

export const QueryRows = ({
  queries,
  expressions,
  data,
  onRunQueries,
  onQueriesChange,
  onDuplicateQuery,
  condition,
  onSetCondition,
}: Props) => {
  const onRemoveQuery = (query: DataQuery) => {
    onQueriesChange(queries.filter((q) => q.refId !== query.refId));
  };

  const onChangeTimeRange = (timeRange: RelativeTimeRange, index: number) => {
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

  const onChangeQueryOptions = (options: AlertQueryOptions, index: number) => {
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

  const onChangeDataSource = (settings: DataSourceInstanceSettings, index: number) => {
    const updatedQueries = queries.map((item, itemIndex) => {
      if (itemIndex !== index) {
        return item;
      }

      const previousSettings = getDataSourceSettings(item);

      // Copy model if changing to a datasource of same type.
      if (settings.type === previousSettings?.type) {
        return copyModel(item, settings);
      }
      return newModel(item, settings);
    });

    onQueriesChange(updatedQueries);
  };

  const onChangeQuery = (query: DataQuery, index: number) => {
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

  const onDragEnd = (result: DropResult) => {
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

  const thresholdByRefId = getThresholdsForQueries([...queries, ...expressions], condition);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="alerting-queries" direction="vertical">
        {(provided) => {
          return (
            <div ref={provided.innerRef} {...provided.droppableProps}>
              <Stack direction="column">
                {queries.map((query, index) => (
                  <QueryRowItem
                    key={query.refId}
                    query={query}
                    index={index}
                    queries={[...queries, ...expressions]}
                    data={data?.[query.refId] ?? { series: [], state: LoadingState.NotStarted }}
                    condition={condition}
                    threshold={thresholdByRefId[query.refId]}
                    onChangeQuery={onChangeQuery}
                    onRemoveQuery={onRemoveQuery}
                    onChangeDataSource={onChangeDataSource}
                    onDuplicateQuery={onDuplicateQuery}
                    onChangeTimeRange={onChangeTimeRange}
                    onChangeQueryOptions={onChangeQueryOptions}
                    onRunQueries={onRunQueries}
                    onSetCondition={onSetCondition}
                  />
                ))}
                {provided.placeholder}
              </Stack>
            </div>
          );
        }}
      </Droppable>
    </DragDropContext>
  );
};

interface QueryRowItemProps {
  query: AlertQuery;
  index: number;
  queries: AlertQuery[];
  data: PanelData;
  condition: string | null;
  threshold?: ThresholdDefinition;
  onChangeQuery: (query: DataQuery, index: number) => void;
  onRemoveQuery: (query: DataQuery) => void;
  onChangeDataSource: (settings: DataSourceInstanceSettings, index: number) => void;
  onDuplicateQuery: (query: AlertQuery) => void;
  onChangeTimeRange: (timeRange: RelativeTimeRange, index: number) => void;
  onChangeQueryOptions: (options: AlertQueryOptions, index: number) => void;
  onRunQueries: () => void;
  onSetCondition: (refId: string) => void;
}

const QueryRowItem = ({
  query,
  index,
  queries,
  data,
  condition,
  threshold,
  onChangeQuery,
  onRemoveQuery,
  onChangeDataSource,
  onDuplicateQuery,
  onChangeTimeRange,
  onChangeQueryOptions,
  onRunQueries,
  onSetCondition,
}: QueryRowItemProps) => {
  const dsSettings = getDataSourceSettings(query);

  if (!dsSettings) {
    return (
      <DatasourceNotFound
        index={index}
        model={query.model}
        onUpdateDatasource={() => {
          const defaultDataSource = getDatasourceSrv().getInstanceSettings(null);
          if (defaultDataSource) {
            onChangeDataSource(defaultDataSource, index);
          }
        }}
        onRemoveQuery={() => onRemoveQuery(query)}
      />
    );
  }

  const isCondition = condition === query.refId;
  const error = isCondition ? errorFromCurrentCondition(data) : errorFromPreviewData(data);

  return (
    <QueryWrapper
      index={index}
      dsSettings={dsSettings}
      data={data}
      error={error}
      query={query}
      onChangeQuery={onChangeQuery}
      onRemoveQuery={onRemoveQuery}
      queries={queries}
      onChangeDataSource={onChangeDataSource}
      onDuplicateQuery={onDuplicateQuery}
      onChangeTimeRange={onChangeTimeRange}
      onChangeQueryOptions={onChangeQueryOptions}
      thresholds={threshold?.config}
      thresholdsType={threshold?.mode}
      onRunQueries={onRunQueries}
      condition={condition}
      onSetCondition={onSetCondition}
    />
  );
};

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
        <Card noMargin>
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
