import React, { PureComponent } from 'react';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { css } from 'emotion';
import { DataQuery, DataSourceSelectItem, dateMath, GrafanaTheme } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';
import { QueryGroup } from '../../query/components/QueryGroup';
import { PanelQueryRunner } from '../../query/state/PanelQueryRunner';
import { QueryGroupOptions } from '../../query/components/QueryGroupOptions';
import { dataSourceChange, queriesChange, queryOptionsChange } from '../state/actions';
import { StoreState } from '../../../types';

interface OwnProps {}

interface ConnectedProps {
  queries: DataQuery[];
  queryOptions: QueryGroupOptions;
  dataSourceName: string;
  queryRunner: PanelQueryRunner;
}
interface DispatchProps {
  dataSourceChange: typeof dataSourceChange;
  queriesChange: typeof queriesChange;
  queryOptionsChange: typeof queryOptionsChange;
}

type Props = ConnectedProps & DispatchProps & OwnProps;

export class AlertingQueryEditor extends PureComponent<Props> {
  onQueriesChange = (queries: DataQuery[]) => {
    this.props.queriesChange(queries);
  };

  onQueryOptionsChange = (queryOptions: QueryGroupOptions) => {
    this.props.queryOptionsChange(queryOptions);
  };

  onRunQueries = () => {
    const { queryRunner, queries, dataSourceName, queryOptions } = this.props;
    const timeRange = { from: 'now-1h', to: 'now' };

    queryRunner.run({
      queries,
      timezone: 'browser',
      datasource: dataSourceName,
      timeRange: { from: dateMath.parse(timeRange.from)!, to: dateMath.parse(timeRange.to)!, raw: timeRange },
      maxDataPoints: queryOptions.maxDataPoints ?? 100,
      minInterval: queryOptions.minInterval,
    });
  };

  onDataSourceChange = (ds: DataSourceSelectItem, queries: DataQuery[]) => {
    this.props.dataSourceChange(ds.value!, queries);
  };

  render() {
    const { queryOptions, queryRunner, queries, dataSourceName } = this.props;
    const styles = getStyles(config.theme);

    return (
      <div className={styles.wrapper}>
        <div className={styles.container}>
          <h4>Queries</h4>
          <QueryGroup
            queryRunner={queryRunner}
            queries={queries}
            dataSourceName={dataSourceName}
            options={queryOptions}
            onRunQueries={this.onRunQueries}
            onQueriesChange={this.onQueriesChange}
            onDataSourceChange={this.onDataSourceChange}
            onOptionsChange={this.onQueryOptionsChange}
          />
        </div>
      </div>
    );
  }
}

const mapsStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = state => {
  return {
    queries: state.alertDefinition.queries,
    queryOptions: state.alertDefinition.queryOptions,
    queryRunner: state.alertDefinition.queryRunner,
    dataSourceName: state.alertDefinition.dataSourceName,
  };
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  dataSourceChange,
  queriesChange,
  queryOptionsChange,
};

export default connect(mapsStateToProps, mapDispatchToProps)(AlertingQueryEditor);

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    wrapper: css`
      padding-left: ${theme.spacing.md};
    `,
    container: css`
      padding: ${theme.spacing.md};
      background-color: ${theme.colors.panelBg};
    `,
    editorWrapper: css`
      border: 1px solid ${theme.colors.panelBorder};
      border-radius: ${theme.border.radius.md};
    `,
  };
});
