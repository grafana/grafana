import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import Page from 'app/core/components/Page/Page';
import OrgActionBar from 'app/core/components/OrgActionBar/OrgActionBar';
import PluginList from './PluginList';
import { loadPlugins, setPluginsLayoutMode, setPluginsSearchQuery } from './state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { getLayoutMode, getPlugins, getPluginsSearchQuery } from './state/selectors';
import { LayoutMode } from 'app/core/components/LayoutSelector/LayoutSelector';
import { NavModel } from '@grafana/data';
import { PluginMeta } from '@grafana/data';
import { StoreState } from 'app/types';

export interface Props {
  navModel: NavModel;
  plugins: PluginMeta[];
  layoutMode: LayoutMode;
  searchQuery: string;
  hasFetched: boolean;
  loadPlugins: typeof loadPlugins;
  setPluginsLayoutMode: typeof setPluginsLayoutMode;
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
    const {
      hasFetched,
      navModel,
      plugins,
      layoutMode,
      setPluginsLayoutMode,
      setPluginsSearchQuery,
      searchQuery,
    } = this.props;

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
              layoutMode={layoutMode}
              onSetLayoutMode={mode => setPluginsLayoutMode(mode)}
              setSearchQuery={query => setPluginsSearchQuery(query)}
              linkButton={linkButton}
            />
            {hasFetched && plugins && (plugins && <PluginList plugins={plugins} layoutMode={layoutMode} />)}
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
    layoutMode: getLayoutMode(state.plugins),
    searchQuery: getPluginsSearchQuery(state.plugins),
    hasFetched: state.plugins.hasFetched,
  };
}

const mapDispatchToProps = {
  loadPlugins,
  setPluginsLayoutMode,
  setPluginsSearchQuery,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(PluginListPage)
);
