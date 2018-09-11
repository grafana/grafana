import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { NavModel, StoreState } from 'app/types';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import ActionBar from './ActionBar';
import { getNavModel } from 'app/core/selectors/navModel';

interface Props {
  navModel: NavModel;
  hasFilters: boolean;
  sections: [];
  folderId: number;
}

interface State {}

export class DashboardListPage extends PureComponent<Props, State> {
  constructor(props) {
    super(props);

    this.state = {};
  }

  render() {
    const { navModel, folderId, hasFilters, sections } = this.props;

    return (
      <div className="page-container page-body">
        <PageHeader model={navModel} />
        <div className="dashboard-list">{/*folderId && !hasFilters && sections.length === 0 &&*/ <ActionBar />}</div>
      </div>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'manage-dashboards'),
});

export default hot(module)(connect(mapStateToProps)(DashboardListPage));
