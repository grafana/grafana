import { css } from '@emotion/css';
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
import { Button, HorizontalGroup, stylesFactory, Tooltip } from '@grafana/ui';
import { getNextRefIdChar } from 'app/core/utils/query';
import {
  dataSource as expressionDatasource,
  ExpressionDatasourceUID,
} from 'app/features/expressions/ExpressionDatasource';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { ExpressionQueryType } from 'app/features/expressions/types';
import { defaultCondition } from 'app/features/expressions/utils/expressionTypes';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { SavedQueryLink } from '../../../../dashboard/state/PanelModel';
import { AlertingQueryRunner } from '../../state/AlertingQueryRunner';
import { RuleFormValues } from '../../types/rule-form';
import { getDefaultOrFirstCompatibleDataSource } from '../../utils/datasource';

import { QueryRows } from './QueryRows';

interface Props {
  value?: RuleFormValues['queries'];
  onChange: (queries: RuleFormValues['queries']) => void;
}

interface State {
  panelDataByRefId: Record<string, PanelData>;
}

export class QueryEditor extends PureComponent<Props, State> {
  private runner: AlertingQueryRunner;
  private queries: AlertQuery[];
  private savedQueryLink: SavedQueryLink | null;

  constructor(props: Props) {
    super(props);
    this.state = { panelDataByRefId: {} };
    this.runner = new AlertingQueryRunner();
    this.queries = props.value?.queries ?? [];
    this.savedQueryLink = props.value?.savedQueryLink ?? null;
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

  onChangeQueries = (queries: AlertQuery[], savedQueryLink: SavedQueryLink | null) => {
    this.queries = queries;
    this.savedQueryLink = savedQueryLink;
    this.props.onChange({ queries, savedQueryLink });
  };

  onDuplicateQuery = (query: AlertQuery) => {
    const { queries, savedQueryLink } = this;
    this.onChangeQueries(addQuery(queries, query), savedQueryLink);
  };

  onNewAlertingQuery = () => {
    const { queries, savedQueryLink } = this;
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
      }),
      savedQueryLink
    );
  };

  onNewExpressionQuery = () => {
    const { queries, savedQueryLink } = this;

    const lastQuery = queries.at(-1);
    const defaultParams = lastQuery ? [lastQuery.refId] : [];

    this.onChangeQueries(
      addQuery(queries, {
        datasourceUid: ExpressionDatasourceUID,
        model: expressionDatasource.newQuery({
          type: ExpressionQueryType.classic,
          conditions: [{ ...defaultCondition, query: { params: defaultParams } }],
          expression: lastQuery?.refId,
        }),
      }),
      savedQueryLink
    );
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

  render() {
    const { queries = [], savedQueryLink } = this.props.value ?? { queries: [], savedQueryLink: null };
    const { panelDataByRefId } = this.state;
    const styles = getStyles(config.theme2);

    const noCompatibleDataSources = getDefaultOrFirstCompatibleDataSource() === undefined;

    return (
      <div className={styles.container}>
        <QueryRows
          savedQueryLink={savedQueryLink}
          data={panelDataByRefId}
          queries={queries}
          onQueriesChange={this.onChangeQueries}
          onDuplicateQuery={this.onDuplicateQuery}
          onRunQueries={this.onRunQueries}
        />
        <HorizontalGroup spacing="sm" align="flex-start">
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
          {config.expressionsEnabled && (
            <Button type="button" icon="plus" onClick={this.onNewExpressionQuery} variant="secondary">
              Add expression
            </Button>
          )}
          {this.renderRunQueryButton()}
        </HorizontalGroup>
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
    runWrapper: css`
      margin-top: ${theme.spacing(1)};
    `,
    editorWrapper: css`
      border: 1px solid ${theme.colors.border.medium};
      border-radius: ${theme.shape.borderRadius()};
    `,
  };
});
