import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { NavModel, StoreState } from 'app/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { getServerStats, ServerStat } from './state/apis';
import PageHeader from 'app/core/components/PageHeader/PageHeader';

interface Props {
  navModel: NavModel;
  getServerStats: () => Promise<ServerStat[]>;
}

interface State {
  stats: ServerStat[];
}

export class ServerStats extends PureComponent<Props, State> {
  constructor(props) {
    super(props);

    this.state = {
      stats: [],
    };
  }

  async componentDidMount() {
    try {
      const stats = await this.props.getServerStats();
      this.setState({ stats });
    } catch (error) {
      console.error(error);
    }
  }

  render() {
    const { navModel } = this.props;
    const { stats } = this.state;

    return (
      <div>
        <PageHeader model={navModel} />
        <div className="page-container page-body">
          <table className="filter-table form-inline">
            <thead>
              <tr>
                <th>Name</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>{stats.map(StatItem)}</tbody>
          </table>
        </div>
      </div>
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
