import React from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import Page from 'app/core/components/Page/Page';
import OrgActionBar from 'app/core/components/OrgActionBar/OrgActionBar';
import PluginList from './PluginList';
import { loadPlugins } from './state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { getPlugins, getPluginsSearchQuery } from './state/selectors';
import { NavModel, PluginMeta } from '@grafana/data';
import { StoreState } from 'app/types';
import { setPluginsSearchQuery } from './state/reducers';
import { useAsync } from 'react-use';
import { selectors } from '@grafana/e2e-selectors';
import { PluginsErrorsInfo } from './PluginsErrorsInfo';

export interface Props {
  navModel: NavModel;
  plugins: PluginMeta[];
  searchQuery: string;
  hasFetched: boolean;
  loadPlugins: typeof loadPlugins;
  setPluginsSearchQuery: typeof setPluginsSearchQuery;
}

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

  const linkButton = {
    href: 'https://grafana.com/plugins?utm_source=grafana_plugin_list',
    title: 'Find more plugins on Grafana.com',
  };

  return (
    <Page navModel={navModel} aria-label={selectors.pages.PluginsList.page}>
      <Page.Contents isLoading={!hasFetched}>
        <>
          <OrgActionBar
            searchQuery={searchQuery}
            setSearchQuery={query => setPluginsSearchQuery(query)}
            linkButton={linkButton}
            target="_blank"
          />

          <PluginsErrorsInfo>
            <>
              <br />
              <p>
                Note that <strong>unsigned front-end datasource and panel plugins</strong> are still usable, but this is
                subject to change in the upcoming releases of Grafana
              </p>
            </>
          </PluginsErrorsInfo>
          {hasFetched && plugins && <PluginList plugins={plugins} />}
        </>
      </Page.Contents>
    </Page>
  );
};

function mapStateToProps(state: StoreState) {
  return {
    navModel: getNavModel(state.navIndex, 'plugins'),
    plugins: getPlugins(state.plugins),
    searchQuery: getPluginsSearchQuery(state.plugins),
    hasFetched: state.plugins.hasFetched,
  };
}

const mapDispatchToProps = {
  loadPlugins,
  setPluginsSearchQuery,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(PluginListPage));
