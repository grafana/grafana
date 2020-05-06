import React, { PureComponent } from 'react';
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

export interface Props {
  navModel: NavModel;
  plugins: PluginMeta[];
  searchQuery: string;
  hasFetched: boolean;
  loadPlugins: typeof loadPlugins;
  setPluginsSearchQuery: typeof setPluginsSearchQuery;
}

export class PluginListPage extends PureComponent<Props> {
  componentDidMount() {
    this.fetchPlugins();
  }

  async fetchPlugins() {
    await this.props.loadPlugins();
  }

  render() {
    const { hasFetched, navModel, plugins, setPluginsSearchQuery, searchQuery } = this.props;

    const linkButton = {
      href: 'https://grafana.com/plugins?utm_source=grafana_plugin_list',
      title: 'Find more plugins on Grafana.com',
    };

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={!hasFetched}>
          <>
            <OrgActionBar
              searchQuery={searchQuery}
              setSearchQuery={query => setPluginsSearchQuery(query)}
              linkButton={linkButton}
            />
            {hasFetched && plugins && plugins && <PluginList plugins={plugins} />}
          </>
        </Page.Contents>
      </Page>
    );
  }
}

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
