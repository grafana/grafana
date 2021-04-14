import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { css } from '@emotion/css';
import { DataQuery, DataSourceApi, dateMath, dateTime, GrafanaTheme } from '@grafana/data';
import { Button, HorizontalGroup, Icon, RefreshPicker, stylesFactory, Tooltip } from '@grafana/ui';

import { config } from 'app/core/config';
import { onRunQueries, queryOptionsChange } from '../state/actions';
import { QueryGroupOptions, StoreState } from 'app/types';
import { AlertingQueryRows } from './AlertingQueryRows';
import { MultiQueryRunner } from '../state/MultiQueryRunner';
import { selectors } from '@grafana/e2e-selectors';
import { addQuery } from 'app/core/utils/query';
import { getDataSourceSrv } from '@grafana/runtime';

function mapStateToProps(state: StoreState) {
  return {
    queryOptions: state.alertDefinition.getQueryOptions(),
  };
}

const mapDispatchToProps = {
  queryOptionsChange,
  onRunQueries,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

interface OwnProps {}

interface State {
  queries: DataQuery[];
  defaultDataSource?: DataSourceApi;
}

type Props = OwnProps & ConnectedProps<typeof connector>;

class AlertingQueryEditorUnconnected extends PureComponent<Props, State> {
  private queryRunner: MultiQueryRunner;

  constructor(props: Props) {
    super(props);
    this.queryRunner = new MultiQueryRunner();
    this.state = { queries: [] };
  }

  async componentDidMount() {
    const defaultDataSource = await getDataSourceSrv().get();
    this.setState({ defaultDataSource });
  }

  onQueryOptionsChange = (queryOptions: QueryGroupOptions) => {
    this.props.queryOptionsChange(queryOptions);
  };

  onRunQueries = () => {
    this.queryRunner.run({
      ...this.props.queryOptions,
      queries: this.state.queries,
    });
    //this.props.onRunQueries();
  };

  onIntervalChanged = (interval: string) => {
    this.props.queryOptionsChange({ ...this.props.queryOptions, minInterval: interval });
  };

  onQueriesChanged = (queries: DataQuery[]) => {
    this.setState({ queries });
  };

  onAddQuery = (query: DataQuery) => {
    this.setState((prevState) => ({
      queries: [...prevState.queries, query],
    }));
  };

  onNewQuery = () => {
    this.setState((prevState) => ({
      queries: addQuery(prevState.queries, {
        datasource: prevState.defaultDataSource?.name,
        timeRange: {
          from: dateMath.parse('now-6h')!,
          to: dateTime(),
          raw: { from: 'now-6h', to: 'now' },
        },
      }),
    }));
  };

  onNewExpression = () => {};

  render() {
    const { queries } = this.state;
    const styles = getStyles(config.theme);

    return (
      <div className={styles.wrapper}>
        <div className={styles.container}>
          <h4>Queries</h4>
          <div className={styles.refreshWrapper}>
            <RefreshPicker
              onIntervalChanged={this.onIntervalChanged}
              onRefresh={this.onRunQueries}
              intervals={['15s', '30s']}
            />
          </div>
          <AlertingQueryRows
            queryRunner={this.queryRunner}
            queries={queries}
            onQueriesChange={this.onQueriesChanged}
            onAddQuery={this.onAddQuery}
            onRunQueries={this.onRunQueries}
          />
          {this.renderAddQueryRow(styles)}
        </div>
      </div>
    );
  }

  renderAddQueryRow(styles: ReturnType<typeof getStyles>) {
    return (
      <HorizontalGroup spacing="md" align="flex-start">
        <Button
          icon="plus"
          onClick={this.onNewQuery}
          variant="secondary"
          aria-label={selectors.components.QueryTab.addQuery}
        >
          Query
        </Button>
        {config.expressionsEnabled && (
          <Tooltip content="Experimental feature: queries could stop working in next version" placement="right">
            <Button icon="plus" onClick={this.onNewExpression} variant="secondary" className={styles.expressionButton}>
              <span>Expression&nbsp;</span>
              <Icon name="exclamation-triangle" className="muted" size="sm" />
            </Button>
          </Tooltip>
        )}
      </HorizontalGroup>
    );
  }
}

export const AlertingQueryEditor = connector(AlertingQueryEditorUnconnected);

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    wrapper: css`
      padding-left: ${theme.spacing.md};
      height: 100%;
    `,
    container: css`
      padding: ${theme.spacing.md};
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
