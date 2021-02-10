import React, { PureComponent } from 'react';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { RefreshPicker, stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';
import { QueryGroup } from '../../query/components/QueryGroup';
import { PanelQueryRunner } from '../../query/state/PanelQueryRunner';
import { onRunQueries, queryOptionsChange } from '../state/actions';
import { QueryGroupOptions, StoreState } from 'app/types';

interface OwnProps {}

interface ConnectedProps {
  queryOptions: QueryGroupOptions;
  queryRunner: PanelQueryRunner;
}
interface DispatchProps {
  queryOptionsChange: typeof queryOptionsChange;
  onRunQueries: typeof onRunQueries;
}

type Props = ConnectedProps & DispatchProps & OwnProps;

export class AlertingQueryEditor extends PureComponent<Props> {
  onQueryOptionsChange = (queryOptions: QueryGroupOptions) => {
    this.props.queryOptionsChange(queryOptions);
  };

  onRunQueries = () => {
    this.props.onRunQueries();
  };

  onIntervalChanged = (interval: string) => {
    this.props.queryOptionsChange({ ...this.props.queryOptions, minInterval: interval });
  };

  render() {
    const { queryOptions, queryRunner } = this.props;
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

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state) => {
  return {
    queryOptions: state.alertDefinition.queryOptions,
    queryRunner: state.alertDefinition.queryRunner,
  };
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  queryOptionsChange,
  onRunQueries,
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
    refreshWrapper: css`
      display: flex;
      justify-content: flex-end;
    `,
    editorWrapper: css`
      border: 1px solid ${theme.colors.panelBorder};
      border-radius: ${theme.border.radius.md};
    `,
  };
});
