// Libraries
import React, { PureComponent, ComponentProps } from 'react';
import { connect } from 'react-redux';
// Components
import Page from 'app/core/components/Page/Page';
import PageActionBar from 'app/core/components/PageActionBar/PageActionBar';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { DataSourcesList } from './DataSourcesList';
// Types
import { DataSourceSettings, NavModel } from '@grafana/data';
import { ConfirmModal } from '@grafana/ui';
import { StoreState } from 'app/types';
// Actions
import { loadDataSources, deleteDataSource } from './state/actions';
import { getNavModel } from 'app/core/selectors/navModel';

import { getDataSources, getDataSourcesSearchQuery } from './state/selectors';
import { setDataSourcesSearchQuery } from './state/reducers';

export interface Props {
  navModel: NavModel;
  dataSources: DataSourceSettings[];
  searchQuery: string;
  hasFetched: boolean;
  loadDataSources: typeof loadDataSources;
  deleteDataSource: typeof deleteDataSource;
  setDataSourcesSearchQuery: typeof setDataSourcesSearchQuery;
}

interface State {
  deleting?: number;
}

const emptyListModel: ComponentProps<typeof EmptyListCTA> = {
  title: 'No data sources defined',
  buttonIcon: 'database',
  buttonLink: 'datasources/new',
  buttonTitle: 'Add data source',
  proTip: 'You can also define data sources through configuration files.',
  proTipLink: 'http://docs.grafana.org/administration/provisioning/#datasources?utm_source=grafana_ds_list',
  proTipLinkTitle: 'Learn more',
  proTipTarget: '_blank',
};

const linkButton: ComponentProps<typeof PageActionBar>['linkButton'] = {
  href: 'datasources/new',
  title: 'Add data source',
};

export class DataSourcesListPage extends PureComponent<Props, State> {
  state: State = {
    deleting: undefined,
  };

  componentDidMount() {
    this.props.loadDataSources();
  }

  onDeleteClicked = (id: number) => {
    this.setState({ deleting: id });
  };

  closeConfirmModal = () => {
    this.setState({ deleting: undefined });
  };

  deleteDataSource = () => {
    this.props.deleteDataSource(this.state.deleting, true);
    this.closeConfirmModal();
  };

  render() {
    const { dataSources, navModel, searchQuery, setDataSourcesSearchQuery, hasFetched } = this.props;

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={!hasFetched}>
          <>
            {dataSources.length === 0 ? (
              <EmptyListCTA {...emptyListModel} />
            ) : (
              [
                <PageActionBar
                  searchQuery={searchQuery}
                  setSearchQuery={setDataSourcesSearchQuery}
                  linkButton={linkButton}
                  key="action-bar"
                />,
                <DataSourcesList dataSources={dataSources} key="list" onDeleteClick={this.onDeleteClicked} />,
                <ConfirmModal
                  key="confirm-modal"
                  isOpen={this.state.deleting !== undefined}
                  title="Delete Data Source"
                  body="Are you sure you want to remove this data source?"
                  confirmText="Yes"
                  onConfirm={this.deleteDataSource}
                  onDismiss={this.closeConfirmModal}
                />,
              ]
            )}
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
    searchQuery: getDataSourcesSearchQuery(state.dataSources),
    hasFetched: state.dataSources.hasFetched,
  };
}

const mapDispatchToProps = {
  loadDataSources,
  deleteDataSource,
  setDataSourcesSearchQuery,
};

export default connect(mapStateToProps, mapDispatchToProps)(DataSourcesListPage);
