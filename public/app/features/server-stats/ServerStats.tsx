import React from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { initNav } from 'app/core/actions';
import { ContainerProps } from 'app/types';
import PageHeader from 'app/core/components/PageHeader/PageHeader';

interface Props extends ContainerProps {}

export class ServerStats extends React.Component<Props, any> {
  constructor(props) {
    super(props);

    this.props.initNav('cfg', 'admin', 'server-stats');
    // const { nav, serverStats } = this.props;
    //
    // nav.load('cfg', 'admin', 'server-stats');
    // serverStats.load();
    //
    // store.dispatch(setNav('new', { asd: 'tasd' }));
  }

  render() {
    const { navModel } = this.props;
    console.log('render', navModel);
    return (
      <div>
        <PageHeader model={navModel} />
        <h2>aasd</h2>
      </div>
    );
    // const { nav, serverStats } = this.props;
    // return (
    //   <div>
    //     <PageHeader model={nav as any} />
    //     <div className="page-container page-body">
    //       <table className="filter-table form-inline">
    //         <thead>
    //           <tr>
    //             <th>Name</th>
    //             <th>Value</th>
    //           </tr>
    //         </thead>
    //         <tbody>{serverStats.stats.map(StatItem)}</tbody>
    //       </table>
    //     </div>
    //   </div>
    // );
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

const mapStateToProps = state => ({
  navModel: state.navModel,
});

const mapDispatchToProps = {
  initNav,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(ServerStats));
