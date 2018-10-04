import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import PageHeader from '../../core/components/PageHeader/PageHeader';
import OrgActionBar from '../../core/components/OrgActionBar/OrgActionBar';
import EmptyListCTA from '../../core/components/EmptyListCTA/EmptyListCTA';
import DataSourcesList from './DataSourcesList';
import { DataSource, NavModel } from 'app/types';
import { LayoutMode } from '../../core/components/LayoutSelector/LayoutSelector';
import { loadDataSources, setDataSourcesLayoutMode, setDataSourcesSearchQuery } from './state/actions';
import { getNavModel } from '../../core/selectors/navModel';
import {
  getDataSources,
  getDataSourcesCount,
  getDataSourcesLayoutMode,
  getDataSourcesSearchQuery,
} from './state/selectors';

export interface Props {
  navModel: NavModel;
  dataSources: DataSource[];
  dataSourcesCount: number;
  layoutMode: LayoutMode;
  searchQuery: string;
  loadDataSources: typeof loadDataSources;
  setDataSourcesLayoutMode: typeof setDataSourcesLayoutMode;
  setDataSourcesSearchQuery: typeof setDataSourcesSearchQuery;
}

const emptyListModel = {
  title: 'There are no data sources defined yet',
  buttonIcon: 'gicon gicon-add-datasources',
  buttonLink: 'datasources/new',
  buttonTitle: 'Add data source',
  proTip: 'You can also define data sources through configuration files.',
  proTipLink: 'http://docs.grafana.org/administration/provisioning/#datasources?utm_source=grafana_ds_list',
  proTipLinkTitle: 'Learn more',
  proTipTarget: '_blank',
};

export class DataSourcesListPage extends PureComponent<Props> {
  componentDidMount() {
    this.fetchDataSources();
  }

  async fetchDataSources() {
    return await this.props.loadDataSources();
  }

  render() {
    const {
      dataSources,
      dataSourcesCount,
      navModel,
      layoutMode,
      searchQuery,
      setDataSourcesSearchQuery,
      setDataSourcesLayoutMode,
    } = this.props;

    const linkButton = {
      href: 'datasources/new',
      title: 'Add data source',
    };

    return (
      <div>
        <PageHeader model={navModel} />
        <div className="page-container page-body">
          {dataSourcesCount === 0 ? (
            <EmptyListCTA model={emptyListModel} />
          ) : (
            [
              <OrgActionBar
                layoutMode={layoutMode}
                searchQuery={searchQuery}
                onSetLayoutMode={mode => setDataSourcesLayoutMode(mode)}
                setSearchQuery={query => setDataSourcesSearchQuery(query)}
                linkButton={linkButton}
                key="action-bar"
              />,
              <DataSourcesList dataSources={dataSources} layoutMode={layoutMode} key="list" />,
            ]
          )}
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    navModel: getNavModel(state.navIndex, 'datasources'),
    dataSources: getDataSources(state.dataSources),
    layoutMode: getDataSourcesLayoutMode(state.dataSources),
    dataSourcesCount: getDataSourcesCount(state.dataSources),
    searchQuery: getDataSourcesSearchQuery(state.dataSources),
  };
}

const mapDispatchToProps = {
  loadDataSources,
  setDataSourcesSearchQuery,
  setDataSourcesLayoutMode,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(DataSourcesListPage));
