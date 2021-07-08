import React from 'react';
import { hot } from 'react-hot-loader';
import { connect, ConnectedProps } from 'react-redux';
import Page from 'app/core/components/Page/Page';
import PageActionBar from 'app/core/components/PageActionBar/PageActionBar';
import PluginList from './PluginList';
import { loadPlugins } from './state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { getPlugins, getPluginsSearchQuery } from './state/selectors';
import { StoreState } from 'app/types';
import { setPluginsSearchQuery } from './state/reducers';
import { useAsync } from 'react-use';
import { selectors } from '@grafana/e2e-selectors';
import { PluginsErrorsInfo } from './PluginsErrorsInfo';

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'plugins'),
  plugins: getPlugins(state.plugins),
  searchQuery: getPluginsSearchQuery(state.plugins),
  hasFetched: state.plugins.hasFetched,
});

const mapDispatchToProps = {
  loadPlugins,
  setPluginsSearchQuery,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
export type Props = ConnectedProps<typeof connector>;

export const PluginListPage: React.FC<Props> = ({
  hasFetched,
  navModel,
  plugins,
  setPluginsSearchQuery,
  searchQuery,
  loadPlugins,
}) => {
  useAsync(async () => {
    loadPlugins();
  }, [loadPlugins]);

  let actionTarget: string | undefined = '_blank';
  const linkButton = {
    href: 'https://grafana.com/plugins?utm_source=grafana_plugin_list',
    title: 'Find more plugins on Grafana.com',
  };

  return (
    <Page navModel={navModel} aria-label={selectors.pages.PluginsList.page}>
      <Page.Contents isLoading={!hasFetched}>
        <>
          <PageActionBar
            searchQuery={searchQuery}
            setSearchQuery={(query) => setPluginsSearchQuery(query)}
            linkButton={linkButton}
            placeholder="Search by name, author, description or type"
            target={actionTarget}
          />
          <PluginsErrorsInfo />
          {hasFetched && plugins && <PluginList plugins={plugins} />}
        </>
      </Page.Contents>
    </Page>
  );
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(PluginListPage));
