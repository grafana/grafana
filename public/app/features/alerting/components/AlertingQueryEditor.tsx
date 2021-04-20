import React, { PureComponent } from 'react';
import { css } from '@emotion/css';
import { DataSourceApi, dateMath, dateTime, GrafanaTheme } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Button, HorizontalGroup, Icon, RefreshPicker, stylesFactory, Tooltip } from '@grafana/ui';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { AlertingQueryRows } from './AlertingQueryRows';
import { expressionDatasource } from '../../expressions/ExpressionDatasource';
import { addQuery } from 'app/core/utils/query';
import { defaultCondition } from '../../expressions/utils/expressionTypes';
import { ExpressionQuery, ExpressionQueryType } from '../../expressions/types';
import { AlertingQuery } from '../types';

interface Props {}

interface State {
  queries: Array<AlertingQuery | ExpressionQuery>;
  defaultDataSource?: DataSourceApi;
}

export class AlertingQueryEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { queries: [] };
  }

  async componentDidMount() {
    const defaultDataSource = await getDataSourceSrv().get();
    this.setState({ defaultDataSource });
  }

  onRunQueries = () => {};

  onIntervalChanged = (interval: string) => {};

  onQueriesChanged = (queries: Array<AlertingQuery | ExpressionQuery>) => {
    this.setState({ queries });
  };

  onAddQuery = (query: AlertingQuery | ExpressionQuery) => {
    this.setState((prevState) => ({
      queries: [...prevState.queries, query],
    }));
  };

  onNewAlertingQuery = () => {
    this.setState((prevState) => ({
      queries: addQuery(prevState.queries, newAlertingQuery()),
    }));
  };

  onNewExpressionQuery = () => {
    this.setState((prevState) => ({
      queries: addQuery(
        prevState.queries,
        expressionDatasource.newQuery({
          type: ExpressionQueryType.classic,
          conditions: [defaultCondition],
        })
      ),
    }));
  };

  renderAddQueryRow(styles: ReturnType<typeof getStyles>) {
    return (
      <HorizontalGroup spacing="md" align="flex-start">
        <Button
          type="button"
          icon="plus"
          onClick={this.onNewAlertingQuery}
          variant="secondary"
          aria-label={selectors.components.QueryTab.addQuery}
        >
          Query
        </Button>
        {config.expressionsEnabled && (
          <Tooltip content="Experimental feature: queries could stop working in next version" placement="right">
            <Button
              type="button"
              icon="plus"
              onClick={this.onNewExpressionQuery}
              variant="secondary"
              className={styles.expressionButton}
            >
              <span>Expression&nbsp;</span>
              <Icon name="exclamation-triangle" className="muted" size="sm" />
            </Button>
          </Tooltip>
        )}
      </HorizontalGroup>
    );
  }

  render() {
    const { queries } = this.state;
    const styles = getStyles(config.theme);
    return (
      <div className={styles.container}>
        {queries.length > 0 && (
          <div className={styles.refreshWrapper}>
            <RefreshPicker
              onIntervalChanged={this.onIntervalChanged}
              onRefresh={this.onRunQueries}
              intervals={['15s', '30s']}
            />
          </div>
        )}
        <AlertingQueryRows
          queries={queries}
          onQueriesChange={this.onQueriesChanged}
          onAddQuery={this.onAddQuery}
          onRunQueries={this.onRunQueries}
        />
        {this.renderAddQueryRow(styles)}
      </div>
    );
  }
}

const newAlertingQuery = (query?: Partial<AlertingQuery>): Partial<AlertingQuery> => {
  return {
    ...query,
    timeRange: {
      from: dateMath.parse('now-6h')!,
      to: dateTime(),
      raw: { from: 'now-6h', to: 'now' },
    },
  };
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      background-color: ${theme.colors.panelBg};
      height: 100%;
    `,
    refreshWrapper: css`
      display: flex;
      justify-content: flex-end;
    `,
    editorWrapper: css`
      border: 1px solid ${theme.colors.panelBorder};
      border-radius: ${theme.border.radius.md};
    `,
    expressionButton: css`
      margin-right: ${theme.spacing.sm};
    `,
  };
});
