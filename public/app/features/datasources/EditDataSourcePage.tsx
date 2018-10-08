import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import PageHeader from '../../core/components/PageHeader/PageHeader';
import { DataSource, NavModel } from 'app/types';
import { loadDataSource } from './state/actions';
import { getNavModel } from '../../core/selectors/navModel';
import { getRouteParamsId, getRouteParamsPage } from '../../core/selectors/location';
import { getDataSourceLoadingNav } from './state/navModel';
import { getDataSource } from './state/selectors';

export interface Props {
  navModel: NavModel;
  dataSource: DataSource;
  dataSourceId: number;
  pageName: string;
  loadDataSource: typeof loadDataSource;
}

enum PageTypes {
  Settings = 'settings',
  Permissions = 'permissions',
  Dashboards = 'dashboards',
}

export class EditDataSourcePage extends PureComponent<Props> {
  componentDidMount() {
    this.fetchDataSource();
  }

  async fetchDataSource() {
    await this.props.loadDataSource(this.props.dataSourceId);
  }

  isValidPage(currentPage) {
    return (Object as any).values(PageTypes).includes(currentPage);
  }

  getCurrentPage() {
    const currentPage = this.props.pageName;

    return this.isValidPage(currentPage) ? currentPage : PageTypes.Permissions;
  }

  renderPage() {
    switch (this.getCurrentPage()) {
      case PageTypes.Permissions:
        return <div>Permissions</div>;
    }

    return null;
  }

  render() {
    const { navModel } = this.props;

    return (
      <div>
        <PageHeader model={navModel} />
        <div className="page-container page-body">{this.renderPage()}</div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  const pageName = getRouteParamsPage(state.location) || PageTypes.Permissions;
  const dataSourceId = getRouteParamsId(state.location);
  const dataSourceLoadingNav = getDataSourceLoadingNav(pageName);

  return {
    navModel: getNavModel(state.navIndex, `datasource-${pageName}-${dataSourceId}`, dataSourceLoadingNav),
    dataSourceId: dataSourceId,
    dataSource: getDataSource(state.dataSources, dataSourceId),
    pageName: pageName,
  };
}

const mapDispatchToProps = {
  loadDataSource,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(EditDataSourcePage));
