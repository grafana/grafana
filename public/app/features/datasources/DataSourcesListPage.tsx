// Libraries
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';

// Components
import Page from 'app/core/components/Page/Page';
import OrgActionBar from 'app/core/components/OrgActionBar/OrgActionBar';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import DataSourcesList from './DataSourcesList';

// Types
import { DataSourceSettings } from '@grafana/data';
import { NavModel } from '@grafana/data';
import { StoreState } from 'app/types';
import { LayoutMode } from 'app/core/components/LayoutSelector/LayoutSelector';

// Actions
import { loadDataSources, setDataSourcesLayoutMode, setDataSourcesSearchQuery } from './state/actions';
import { getNavModel } from 'app/core/selectors/navModel';

import {
  getDataSources,
  getDataSourcesCount,
  getDataSourcesLayoutMode,
  getDataSourcesSearchQuery,
} from './state/selectors';

export interface Props {
  navModel: NavModel;
  dataSources: DataSourceSettings[];
  dataSourcesCount: number;
  layoutMode: LayoutMode;
  searchQuery: string;
  hasFetched: boolean;
  loadDataSources: typeof loadDataSources;
  setDataSourcesLayoutMode: typeof setDataSourcesLayoutMode;
  setDataSourcesSearchQuery: typeof setDataSourcesSearchQuery;
}

const emptyListModel = {
  title: 'There are no data sources defined yet',
  buttonIcon: 'gicon gicon-datasources',
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
      hasFetched,
    } = this.props;

    const linkButton = {
      href: 'datasources/new',
      title: 'Add data source',
    };

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={!hasFetched}>
          <>
            {hasFetched && dataSourcesCount === 0 && <EmptyListCTA {...emptyListModel} />}
            {hasFetched &&
              dataSourcesCount > 0 && [
                <OrgActionBar
                  layoutMode={layoutMode}
                  searchQuery={searchQuery}
                  onSetLayoutMode={mode => setDataSourcesLayoutMode(mode)}
                  setSearchQuery={query => setDataSourcesSearchQuery(query)}
                  linkButton={linkButton}
                  key="action-bar"
                />,
                <DataSourcesList dataSources={dataSources} layoutMode={layoutMode} key="list" />,
              ]}
          </>
        </Page.Contents>
      </Page>
    );
  }
}

function mapStateToProps(state: StoreState) {
  return {
    navModel: getNavModel(state.navIndex, 'datasources'),
    dataSources: getDataSources(state.dataSources),
    layoutMode: getDataSourcesLayoutMode(state.dataSources),
    dataSourcesCount: getDataSourcesCount(state.dataSources),
    searchQuery: getDataSourcesSearchQuery(state.dataSources),
    hasFetched: state.dataSources.hasFetched,
  };
}

const mapDispatchToProps = {
  loadDataSources,
  setDataSourcesSearchQuery,
  setDataSourcesLayoutMode,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(DataSourcesListPage)
);
