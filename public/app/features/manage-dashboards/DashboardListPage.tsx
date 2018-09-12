import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { NavModel } from 'app/types';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import ActionBar from './ActionBar';
import Filters from './Filters';
import { getNavModel } from 'app/core/selectors/navModel';
import { getFolderId, getHasFilters, getSections } from './state/selectors';

interface Props {
  navModel: NavModel;
  hasFilters: boolean;
  sections: [];
  folderId: number;
}

export class DashboardListPage extends PureComponent<Props, any> {
  render() {
    const { navModel, folderId, hasFilters, sections } = this.props;

    return (
      <div>
        <PageHeader model={navModel} />
        <div className="page-container page-body">
          {folderId !== null &&
            !hasFilters &&
            sections.length === 0 && (
              <div className="dashboard-list">
                <ActionBar />
                {hasFilters && <Filters />}
              </div>
            )}
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  const manageDashboardsState = state.manageDashboards;

  return {
    navModel: getNavModel(state.navIndex, 'manage-dashboards'),
    hasFilters: getHasFilters(manageDashboardsState),
    sections: getSections(manageDashboardsState),
    folderId: getFolderId(manageDashboardsState),
  };
}

export default hot(module)(connect(mapStateToProps)(DashboardListPage));
