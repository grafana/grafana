import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { CardContainer, Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2, NavModel } from '@grafana/data';
import { StoreState } from 'app/types';
import { getNavModel } from 'app/core/selectors/navModel';
import Page from 'app/core/components/Page/Page';
import { getServerStats, ServerStat } from './state/apis';
import { css } from '@emotion/css';

interface Props {
  navModel: NavModel;
  getServerStats: () => Promise<ServerStat[]>;
}

interface State {
  stats: ServerStat[];
  isLoading: boolean;
}

export class ServerStats extends PureComponent<Props, State> {
  state: State = {
    stats: [],
    isLoading: true,
  };

  async componentDidMount() {
    try {
      const stats = await this.props.getServerStats();
      this.setState({ stats, isLoading: false });
    } catch (error) {
      console.error(error);
    }
  }

  render() {
    const { navModel } = this.props;
    const { stats, isLoading } = this.state;

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={isLoading}>
          <table className="filter-table form-inline">
            <thead>
              <tr>
                <th>Name</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>{stats.map(StatItem)}</tbody>
          </table>
        </Page.Contents>
      </Page>
    );
  }
}

function StatItem(stat: ServerStat) {
  return (
    <tr key={stat.name}>
      <td>
        {stat.name}{' '}
        {stat.tooltip && (
          <Tooltip content={stat.tooltip} placement={'top'}>
            <Icon name={'info-circle'} />
          </Tooltip>
        )}
      </td>
      <td>{stat.value}</td>
    </tr>
  );
}

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'server-stats'),
  getServerStats: getServerStats,
});

type StatCardProps = {
  content: Array<Record<string, string>>;
  footer?: JSX.Element;
};

const StatCard = ({ content, footer }: StatCardProps) => {
  const styles = useStyles2(getStyles);
  return (
    <CardContainer className={styles.container} disableHover>
      <div className={styles.content}>
        {content.map((item) => {
          return (
            <div key={item.name} className={styles.row}>
              <span>{item.name}</span>
              <span>{item.value}</span>
            </div>
          );
        })}
      </div>
      {footer && <div>{footer}</div>}
    </CardContainer>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      padding: ${theme.spacing(2)};
    `,
    content: css``,
    row: css`
      display: flex;
      justify-content: space-between;
      width: 100%;
      margin-bottom: ${theme.spacing(2)};
      align-items: center;
    `,
    footer: css``,
  };
};
export default hot(module)(connect(mapStateToProps)(ServerStats));
