import React from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { initNav } from 'app/core/actions';
import { ContainerProps } from 'app/types';
import { getServerStats, ServerStat } from './api';
import PageHeader from 'app/core/components/PageHeader/PageHeader';

interface Props extends ContainerProps {
  getServerStats: () => Promise<ServerStat[]>;
}

interface State {
  stats: ServerStat[];
}

export class ServerStats extends React.Component<Props, State> {
  constructor(props) {
    super(props);

    this.state = {
      stats: [],
    };

    this.props.initNav('cfg', 'admin', 'server-stats');
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

const mapStateToProps = state => ({
  navModel: state.navModel,
  getServerStats: getServerStats,
});

const mapDispatchToProps = {
  initNav,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(ServerStats));
