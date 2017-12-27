import React from 'react';
import { inject, observer } from 'mobx-react';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import { NavModel, NavModelSrv } from 'app/core/nav_model_srv';

export interface IProps {
  store: any;
}

@inject('store')
@observer
export class ServerStats extends React.Component<IProps, any> {
  constructor(props) {
    super(props);

    // this.navModel = new NavModelSrv().getNav('cfg', 'admin', 'server-stats', 1);
    this.props.store.nav.load('cfg', 'admin', 'server-stats');
    this.props.store.serverStats.load();
  }

  render() {
    return (
      <div>
        <PageHeader model={this.props.store.nav} />
        <div className="page-container page-body">
          <table className="filter-table form-inline">
            <thead>
              <tr>
                <th>Name</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>{this.props.store.serverStats.stats.map(StatItem)}</tbody>
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
