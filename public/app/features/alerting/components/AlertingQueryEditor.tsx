import React, { PureComponent } from 'react';
import { css } from '@emotion/css';
import { DataSourceApi, GrafanaTheme } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Button, HorizontalGroup, Icon, stylesFactory, Tooltip } from '@grafana/ui';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { AlertingQueryRows } from './AlertingQueryRows';
import {
  expressionDatasource,
  ExpressionDatasourceID,
  ExpressionDatasourceUID,
} from '../../expressions/ExpressionDatasource';
import { getNextRefIdChar } from 'app/core/utils/query';
import { defaultCondition } from '../../expressions/utils/expressionTypes';
import { ExpressionQueryType } from '../../expressions/types';
import { GrafanaQuery, GrafanaQueryModel } from 'app/types/unified-alerting-dto';

interface Props {
  value?: GrafanaQuery[];
  onChange: (queries: GrafanaQuery[]) => void;
}

interface State {
  defaultDataSource?: DataSourceApi;
}
export class AlertingQueryEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {};
  }

  async componentDidMount() {
    try {
      const defaultDataSource = await getDataSourceSrv().get();
      this.setState({ defaultDataSource });
    } catch (error) {
      console.error(error);
    }
  }

  onRunQueries = () => {};

  onDuplicateQuery = (query: GrafanaQuery) => {
    const { onChange, value = [] } = this.props;
    onChange([...value, query]);
  };

  onNewAlertingQuery = () => {
    const { onChange, value = [] } = this.props;
    const { defaultDataSource } = this.state;

    if (!defaultDataSource) {
      return;
    }

    const alertingQuery: GrafanaQueryModel = {
      refId: '',
      datasourceUid: defaultDataSource.uid,
      datasource: defaultDataSource.name,
    };

    onChange(addQuery(value, alertingQuery));
  };

  onNewExpressionQuery = () => {
    const { onChange, value = [] } = this.props;
    const expressionQuery: GrafanaQueryModel = {
      ...expressionDatasource.newQuery({
        type: ExpressionQueryType.classic,
        conditions: [defaultCondition],
      }),
      datasourceUid: ExpressionDatasourceUID,
      datasource: ExpressionDatasourceID,
    };

    onChange(addQuery(value, expressionQuery));
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
    const { value = [] } = this.props;
    const styles = getStyles(config.theme);
    return (
      <div className={styles.container}>
        <AlertingQueryRows
          queries={value}
          onQueriesChange={this.props.onChange}
          onDuplicateQuery={this.onDuplicateQuery}
          onRunQueries={this.onRunQueries}
        />
        {this.renderAddQueryRow(styles)}
      </div>
    );
  }
}

const addQuery = (queries: GrafanaQuery[], model: GrafanaQueryModel): GrafanaQuery[] => {
  const refId = getNextRefIdChar(queries);

  const query: GrafanaQuery = {
    refId,
    queryType: '',
    model: {
      ...model,
      hide: false,
      refId: refId,
    },
    relativeTimeRange: {
      from: 21600,
      to: 0,
    },
  };

  return [...queries, query];
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
