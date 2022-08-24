import { css } from '@emotion/css';
import { reject } from 'lodash';
import React, { PureComponent } from 'react';

import {
  DataQuery,
  getDefaultRelativeTimeRange,
  GrafanaTheme2,
  LoadingState,
  PanelData,
  RelativeTimeRange,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { Button, Stack, stylesFactory, Tooltip } from '@grafana/ui';
import { getNextRefIdChar } from 'app/core/utils/query';
import {
  dataSource as expressionDatasource,
  ExpressionDatasourceUID,
} from 'app/features/expressions/ExpressionDatasource';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { ExpressionQuery, ExpressionQueryType } from 'app/features/expressions/types';
import { defaultCondition } from 'app/features/expressions/utils/expressionTypes';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { AlertingQueryRunner } from '../../state/AlertingQueryRunner';
import { getDefaultOrFirstCompatibleDataSource } from '../../utils/datasource';
import { Expression } from '../expressions/Expression';

import { QueryRows } from './QueryRows';

interface Props {
  value?: AlertQuery[];
  condition?: string | null;
  onChange: (queries: AlertQuery[]) => void;
  onSetCondition: (refId: string) => void;
  editingExistingRule?: boolean;
}

interface State {
  panelDataByRefId: Record<string, PanelData>;
}

export class QueryEditor extends PureComponent<Props, State> {
  private runner: AlertingQueryRunner;
  private queries: AlertQuery[];

  constructor(props: Props) {
    super(props);
    this.state = { panelDataByRefId: {} };
    this.runner = new AlertingQueryRunner();
    this.queries = props.value ?? [];
  }

  componentDidMount() {
    this.runner.get().subscribe((data) => {
      this.setState({ panelDataByRefId: data });
    });
  }

  componentWillUnmount() {
    this.runner.destroy();
  }

  onRunQueries = () => {
    const { queries } = this;
    this.runner.run(queries);
  };

  onCancelQueries = () => {
    this.runner.cancel();
  };

  onChangeQueries = (queries: AlertQuery[]) => {
    this.queries = queries;
    this.props.onChange(queries);
  };

  onChangeDataQueries = (updatedDataQueries: AlertQuery[]) => {
    const queriesWithoutDataQueries: AlertQuery[] = this.queries.filter((query) => isExpressionQuery(query.model));
    const newQueries = queriesWithoutDataQueries.concat(updatedDataQueries);

    this.onChangeQueries(newQueries);
  };

  onRemoveQuery = (refId: string) => {
    const newQueries = reject(this.queries, (query) => query.refId === refId);
    this.onChangeQueries(newQueries);
  };

  onDuplicateQuery = (query: AlertQuery) => {
    const { queries } = this;
    this.onChangeQueries(addQuery(queries, query));
  };

  onNewAlertingQuery = () => {
    const { queries } = this;
    const datasource = getDefaultOrFirstCompatibleDataSource();

    if (!datasource) {
      return;
    }

    this.onChangeQueries(
      addQuery(queries, {
        datasourceUid: datasource.uid,
        model: {
          refId: '',
          datasource: {
            type: datasource.type,
            uid: datasource.uid,
          },
        },
      })
    );
  };

  onNewExpressionQuery = () => {
    const { queries } = this;

    const lastQuery = queries.at(-1);
    const defaultParams = lastQuery ? [lastQuery.refId] : [];

    const newQueries = addQuery(queries, {
      datasourceUid: ExpressionDatasourceUID,
      model: expressionDatasource.newQuery({
        type: ExpressionQueryType.classic,
        conditions: [{ ...defaultCondition, query: { params: defaultParams } }],
        expression: lastQuery?.refId,
      }),
    });

    this.onChangeQueries(newQueries);
  };

  isRunning() {
    const data = Object.values(this.state.panelDataByRefId).find((d) => Boolean(d));
    return data?.state === LoadingState.Loading;
  }

  renderRunQueryButton() {
    const isRunning = this.isRunning();

    if (isRunning) {
      return (
        <Button icon="fa fa-spinner" type="button" variant="destructive" onClick={this.onCancelQueries}>
          Cancel
        </Button>
      );
    }

    return (
      <Button icon="sync" type="button" onClick={this.onRunQueries}>
        Run queries
      </Button>
    );
  }

  updateExpressionQuery(updatedModel: ExpressionQuery) {
    const queries = this.queries;

    const newQueries = queries.map((query) => {
      const isUpdatedQuery = query.refId === updatedModel.refId;
      return isUpdatedQuery ? { ...query, model: updatedModel } : query;
    });

    this.onChangeQueries(newQueries);
    this.onRunQueries();
  }

  onUpdateExpressionType(refId: string, type: ExpressionQueryType) {
    const queries = this.queries;

    const newQueries = queries.map((query) => {
      return query.refId === refId ? { ...query, model: { ...query.model, type }, type } : query;
    });

    this.onChangeQueries(newQueries);
  }

  render() {
    const { value = [] } = this.props;
    const { panelDataByRefId } = this.state;
    const styles = getStyles(config.theme2);

    const noCompatibleDataSources = getDefaultOrFirstCompatibleDataSource() === undefined;

    // these are only the data queries
    const dataQueries = value.filter((q) => !isExpressionQuery(q.model));

    // these are only the expression queries
    const expressionQueries = value.reduce((acc: ExpressionQuery[], query) => {
      return isExpressionQuery(query.model) ? acc.concat(query.model) : acc;
    }, []);

    return (
      <div className={styles.container}>
        <Stack direction="column">
          <QueryRows
            data={panelDataByRefId}
            queries={dataQueries}
            onQueriesChange={this.onChangeDataQueries}
            onDuplicateQuery={this.onDuplicateQuery}
            onRunQueries={this.onRunQueries}
          />
          <Stack direction="row" alignItems="stretch">
            {expressionQueries.map((query) => (
              <Expression
                key={query.refId}
                isAlertCondition={this.props.condition === query.refId}
                data={panelDataByRefId[query.refId]}
                queries={this.queries}
                query={query}
                onSetCondition={this.props.onSetCondition}
                onRemoveExpression={this.onRemoveQuery}
                onUpdateRefId={(refId) => {}}
                onUpdateExpressionType={(refId, type) => this.onUpdateExpressionType(refId, type)}
                onChangeQuery={(query) => this.updateExpressionQuery(query)}
              />
            ))}
            {config.expressionsEnabled && (
              <Button type="button" icon="plus" onClick={this.onNewExpressionQuery} variant="secondary">
                Add expression
              </Button>
            )}
          </Stack>
          <Stack direction="row" gap={1} alignItems="center">
            <Tooltip content={'You appear to have no compatible data sources'} show={noCompatibleDataSources}>
              <Button
                type="button"
                icon="plus"
                onClick={this.onNewAlertingQuery}
                variant="secondary"
                aria-label={selectors.components.QueryTab.addQuery}
                disabled={noCompatibleDataSources}
              >
                Add query
              </Button>
            </Tooltip>
            {this.renderRunQueryButton()}
          </Stack>
        </Stack>
      </div>
    );
  }
}

const addQuery = (queries: AlertQuery[], queryToAdd: Pick<AlertQuery, 'model' | 'datasourceUid'>): AlertQuery[] => {
  const refId = getNextRefIdChar(queries);

  const query: AlertQuery = {
    ...queryToAdd,
    refId,
    queryType: '',
    model: {
      ...queryToAdd.model,
      hide: false,
      refId,
    },
    relativeTimeRange: defaultTimeRange(queryToAdd.model),
  };

  return [...queries, query];
};

const defaultTimeRange = (model: DataQuery): RelativeTimeRange | undefined => {
  if (isExpressionQuery(model)) {
    return;
  }

  return getDefaultRelativeTimeRange();
};

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    container: css`
      background-color: ${theme.colors.background.primary};
      height: 100%;
      max-width: ${theme.breakpoints.values.xxl}px;
    `,
  };
});
