import React from 'react';
import { hot } from 'react-hot-loader';
import { inject, observer } from 'mobx-react';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import IContainerProps from 'app/containers/IContainerProps';

@inject('nav', 'serverStats')
@observer
export class ServerStats extends React.Component<IContainerProps, any> {
  constructor(props) {
    super(props);
    const { nav, serverStats } = this.props;

    nav.load('cfg', 'admin', 'server-stats');
    serverStats.load();
  }

  render() {
    const { nav, serverStats } = this.props;
    return (
      <div>
        <PageHeader model={nav as any} />
        <div className="page-container page-body">
          <table className="filter-table form-inline">
            <thead>
              <tr>
                <th>Name</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>{serverStats.stats.map(StatItem)}</tbody>
          </table>
        </div>
      </div>
    );
  }
}

function StatItem(stat) {
  return (
    <tr key={stat.name}>
      <td>{stat.name}</td>
      <td>{stat.value}</td>
    </tr>
  );
}

export default hot(module)(ServerStats);
