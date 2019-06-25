import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { StoreState } from 'app/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { getServerStats, ServerStat } from './state/apis';
import Page from 'app/core/components/Page/Page';
import { NavModel } from '@grafana/data';

interface Props {
  navModel: NavModel;
  getServerStats: () => Promise<ServerStat[]>;
}

interface State {
  stats: ServerStat[];
  isLoading: boolean;
}

export class ServerStats extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      stats: [],
      isLoading: false,
    };
  }

  async componentDidMount() {
    try {
      this.setState({ isLoading: true });
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
      <td>{stat.name}</td>
      <td>{stat.value}</td>
    </tr>
  );
}

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'server-stats'),
  getServerStats: getServerStats,
});

export default hot(module)(connect(mapStateToProps)(ServerStats));
