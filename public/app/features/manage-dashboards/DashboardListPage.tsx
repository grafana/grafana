import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { DashboardSection, NavModel } from 'app/types';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import ActionBar from './ActionBar';
import ActiveFilters from './ActiveFilters';
import Section from './Section';
import SectionActions from './SectionActions';
import { getNavModel } from 'app/core/selectors/navModel';
import { loadSections } from './state/actions';
import { getSections, getFolderId, getHasFilters } from './state/selectors';

export interface Props {
  navModel: NavModel;
  hasFilters: boolean;
  sections: DashboardSection[];
  folderId: number;
  loadDashboardListItems: typeof loadSections;
}

export class DashboardListPage extends PureComponent<Props, any> {
  componentDidMount() {
    this.fetchSections();
  }

  async fetchSections() {
    await this.props.loadDashboardListItems();
  }

  render() {
    const { navModel, folderId, hasFilters, sections } = this.props;

    return (
      <div>
        <PageHeader model={navModel} />
        <div className="page-container page-body">
          <div className="dashboard-list">
            <ActionBar />
            {hasFilters && <ActiveFilters />}
            {hasFilters &&
              sections.length !== 0 && (
                <div className="search-results">
                  <em className="muted">No dashboards matching your query were found.</em>
                </div>
              )}
            {folderId !== null &&
              !hasFilters &&
              sections.length === 0 && (
                <div className="search-results">
                  <em className="muted">No dashboards found.</em>
                </div>
              )}
            {sections.length > 0 && <SectionActions />}
            <div className="search-results-container">
              {sections.length > 0 &&
                sections.map((section, index) => {
                  return <Section section={section} key={index} />;
                })}
            </div>
          </div>
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
    sections: getSections(state.sections),
    folderId: getFolderId(manageDashboardsState),
  };
}

const mapDispatchToProps = {
  loadDashboardListItems: loadSections,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(DashboardListPage));
