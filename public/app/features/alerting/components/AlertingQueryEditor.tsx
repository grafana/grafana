import React, { PureComponent } from 'react';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { css } from 'emotion';
import { dateMath, GrafanaTheme } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';
import { QueryGroup } from '../../query/components/QueryGroup';
import { PanelQueryRunner } from '../../query/state/PanelQueryRunner';
import { QueryGroupOptions } from '../../query/components/QueryGroupOptions';
import { queryOptionsChange } from '../state/actions';
import { StoreState } from '../../../types';

interface OwnProps {}

interface ConnectedProps {
  queryOptions: QueryGroupOptions;
  queryRunner: PanelQueryRunner;
}
interface DispatchProps {
  queryOptionsChange: typeof queryOptionsChange;
}

type Props = ConnectedProps & DispatchProps & OwnProps;

export class AlertingQueryEditor extends PureComponent<Props> {
  onQueryOptionsChange = (queryOptions: QueryGroupOptions) => {
    this.props.queryOptionsChange(queryOptions);
  };

  onRunQueries = () => {
    const { queryRunner, queryOptions } = this.props;
    const timeRange = { from: 'now-1h', to: 'now' };

    queryRunner.run({
      timezone: 'browser',
      timeRange: { from: dateMath.parse(timeRange.from)!, to: dateMath.parse(timeRange.to)!, raw: timeRange },
      maxDataPoints: queryOptions.maxDataPoints ?? 100,
      minInterval: queryOptions.minInterval,
      queries: queryOptions.queries,
      datasource: queryOptions.dataSource.name!,
    });
  };

  render() {
    const { queryOptions, queryRunner } = this.props;
    const styles = getStyles(config.theme);

    return (
      <div className={styles.wrapper}>
        <div className={styles.container}>
          <h4>Queries</h4>
          <QueryGroup
            queryRunner={queryRunner}
            options={queryOptions}
            onRunQueries={this.onRunQueries}
            onOptionsChange={this.onQueryOptionsChange}
          />
        </div>
      </div>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = state => {
  return {
    queryOptions: state.alertDefinition.queryOptions,
    queryRunner: state.alertDefinition.queryRunner,
  };
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  queryOptionsChange,
};

export default connect(mapStateToProps, mapDispatchToProps)(AlertingQueryEditor);

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
    editorWrapper: css`
      border: 1px solid ${theme.colors.panelBorder};
      border-radius: ${theme.border.radius.md};
    `,
  };
});
