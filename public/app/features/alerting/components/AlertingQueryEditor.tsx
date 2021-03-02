import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { RefreshPicker, stylesFactory } from '@grafana/ui';

import { config } from 'app/core/config';
import { QueryGroup } from '../../query/components/QueryGroup';
import { onRunQueries, queryOptionsChange } from '../state/actions';
import { QueryGroupOptions, StoreState } from 'app/types';

function mapStateToProps(state: StoreState) {
  return {
    queryOptions: state.alertDefinition.getQueryOptions(),
    queryRunner: state.alertDefinition.queryRunner,
  };
}

const mapDispatchToProps = {
  queryOptionsChange,
  onRunQueries,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

interface OwnProps {}

type Props = OwnProps & ConnectedProps<typeof connector>;

class AlertingQueryEditorUnconnected extends PureComponent<Props> {
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
            queryRunner={queryRunner!} // if the queryRunner is undefined here somethings very wrong so it's ok to throw an unhandled error
            options={queryOptions}
            onRunQueries={this.onRunQueries}
            onOptionsChange={this.onQueryOptionsChange}
          />
        </div>
      </div>
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
  };
});
