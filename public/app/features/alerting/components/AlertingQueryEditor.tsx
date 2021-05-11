import React, { PureComponent } from 'react';
import { css } from '@emotion/css';
import {
  DataQuery,
  getDefaultRelativeTimeRange,
  GrafanaTheme2,
  LoadingState,
  PanelData,
  RelativeTimeRange,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Button, HorizontalGroup, Icon, stylesFactory, Tooltip } from '@grafana/ui';
import { config } from '@grafana/runtime';
import { AlertingQueryRows } from './AlertingQueryRows';
import { dataSource as expressionDatasource, ExpressionDatasourceUID } from '../../expressions/ExpressionDatasource';
import { getNextRefIdChar } from 'app/core/utils/query';
import { defaultCondition } from '../../expressions/utils/expressionTypes';
import { ExpressionQueryType } from '../../expressions/types';
import { GrafanaQuery } from 'app/types/unified-alerting-dto';
import { AlertingQueryRunner } from '../state/AlertingQueryRunner';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { isExpressionQuery } from 'app/features/expressions/guards';

interface Props {
  value?: GrafanaQuery[];
  onChange: (queries: GrafanaQuery[]) => void;
}

interface State {
  panelDataByRefId: Record<string, PanelData>;
}
export class AlertingQueryEditor extends PureComponent<Props, State> {
  private runner: AlertingQueryRunner;

  constructor(props: Props) {
    super(props);
    this.state = { panelDataByRefId: {} };
    this.runner = new AlertingQueryRunner();
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
    const { value = [] } = this.props;
    this.runner.run(value);
  };

  onCancelQueries = () => {
    this.runner.cancel();
  };

  onDuplicateQuery = (query: GrafanaQuery) => {
    const { onChange, value = [] } = this.props;
    onChange(addQuery(value, query));
  };

  onNewAlertingQuery = () => {
    const { onChange, value = [] } = this.props;
    const defaultDataSource = getDatasourceSrv().getInstanceSettings('default');

    if (!defaultDataSource) {
      return;
    }

    onChange(
      addQuery(value, {
        datasourceUid: defaultDataSource.uid,
        model: {
          refId: '',
          datasource: defaultDataSource.name,
        },
      })
    );
  };

  onNewExpressionQuery = () => {
    const { onChange, value = [] } = this.props;

    onChange(
      addQuery(value, {
        datasourceUid: ExpressionDatasourceUID,
        model: expressionDatasource.newQuery({
          type: ExpressionQueryType.classic,
          conditions: [defaultCondition],
        }),
      })
    );
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

  isRunning() {
    const data = Object.values(this.state.panelDataByRefId).find((d) => Boolean(d));
    return data?.state === LoadingState.Loading;
  }

  renderRunQueryButton() {
    const isRunning = this.isRunning();
    const styles = getStyles(config.theme2);

    if (isRunning) {
      return (
        <div className={styles.runWrapper}>
          <Button icon="fa fa-spinner" type="button" variant="destructive" onClick={this.onCancelQueries}>
            Cancel
          </Button>
        </div>
      );
    }

    return (
      <div className={styles.runWrapper}>
        <Button icon="sync" type="button" onClick={this.onRunQueries}>
          Run queries
        </Button>
      </div>
    );
  }

  render() {
    const { value = [] } = this.props;
    const { panelDataByRefId } = this.state;
    const styles = getStyles(config.theme2);

    return (
      <div className={styles.container}>
        <AlertingQueryRows
          data={panelDataByRefId}
          queries={value}
          onQueriesChange={this.props.onChange}
          onDuplicateQuery={this.onDuplicateQuery}
          onRunQueries={this.onRunQueries}
        />
        {this.renderAddQueryRow(styles)}
        {this.renderRunQueryButton()}
      </div>
    );
  }
}

const addQuery = (
  queries: GrafanaQuery[],
  queryToAdd: Pick<GrafanaQuery, 'model' | 'datasourceUid'>
): GrafanaQuery[] => {
  const refId = getNextRefIdChar(queries);

  const query: GrafanaQuery = {
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
    `,
    runWrapper: css`
      margin-top: ${theme.spacing(1)};
    `,
    editorWrapper: css`
      border: 1px solid ${theme.colors.border.medium};
      border-radius: ${theme.shape.borderRadius()};
    `,
    expressionButton: css`
      margin-right: ${theme.spacing(0.5)};
    `,
  };
});
