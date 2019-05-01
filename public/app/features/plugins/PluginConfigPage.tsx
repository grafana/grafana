// Libraries
import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';

// Types
import { StoreState, UrlQueryMap } from 'app/types';
import {
  NavModel,
  NavModelItem,
  PluginWithConfig,
  PluginType,
  PluginConfigSaveOptions,
  PanelPlugin,
  PanelPluginMeta,
  PluginIncludeType,
} from '@grafana/ui';

import Page from 'app/core/components/Page/Page';
import { getPluginSettings } from './PluginSettingsCache';
import { importAppPlugin, importDataSourcePlugin, importPanelPlugin } from './plugin_loader';
import { getNotFoundNav } from 'app/core/nav_model_srv';
import { PluginHelp } from 'app/core/components/PluginHelp/PluginHelp';

function getLoadingNav(): NavModel {
  const node = {
    text: 'Loading...',
    icon: 'fa fa-fw fa-spinner fa-spin',
  };
  return {
    node: node,
    main: node,
  };
}

function loadPlugin(pluginId: string): Promise<PluginWithConfig> {
  return getPluginSettings(pluginId).then(info => {
    if (info.type === PluginType.app) {
      return importAppPlugin(info);
    }
    if (info.type === PluginType.datasource) {
      return importDataSourcePlugin(info);
    }
    if (info.type === PluginType.panel) {
      // ??? Skip the initial load?
      // Set the panel plugin meta
      return importPanelPlugin(pluginId).then(plugin => {
        // Add a wrapper around angular panels plugins
        const general = plugin as any;
        if (general.components && general.components.PanelCtrl) {
          const p = new PanelPlugin(null);
          p.meta = info as PanelPluginMeta;
          return p;
        }
        const p = plugin as PanelPlugin;
        p.meta = info as PanelPluginMeta;
        return p;
      });
    }
    return Promise.reject('Unknown Plugin type: ' + info.type);
  });
}

interface Props {
  pluginId: string;
  query: UrlQueryMap;
  path: string; // the URL path
}

interface State {
  loading: boolean;
  plugin?: PluginWithConfig;
  nav: NavModel;
  defaultTab: string; // The first configured one or readme
}

const TAB_ID_README = 'readme';
const TAB_ID_DASHBOARDS = 'dashboards';

class PluginConfigPage extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      loading: true,
      nav: getLoadingNav(),
      defaultTab: TAB_ID_README,
    };
  }

  async componentDidMount() {
    const { pluginId, path, query } = this.props;
    const plugin = await loadPlugin(pluginId);
    if (!plugin) {
      this.setState({
        loading: false,
        nav: getNotFoundNav(),
      });
      return; // 404
    }

    // When an angular version exists use that instead
    if (plugin.angular && plugin.angular.ConfigCtrl && !plugin.configTabs) {
      console.log('redirect to the angular version');
      // HELP! is there a better/faster way???
      window.location.assign(path + 'edit');
      return;
    }

    let defaultTab: string;
    const tabs: NavModelItem[] = [];
    if (true) {
      tabs.push({
        text: 'Readme',
        icon: 'fa fa-fw fa-file-text-o',
        url: path + '?tab=' + TAB_ID_README,
        id: TAB_ID_README,
      });
    }

    if (plugin.configTabs) {
      for (const tab of plugin.configTabs) {
        tabs.push({
          text: tab.title,
          subTitle: tab.subTitle,
          icon: tab.icon,
          url: path + '?tab=' + tab.id,
          id: tab.id,
        });
        if (!defaultTab) {
          defaultTab = tab.id;
        }
      }
    }

    // Check for the dashboard tabs
    if (plugin.meta && plugin.meta.includes) {
      let dashboardCount = 0;
      for (const include of plugin.meta.includes) {
        if (include.type === PluginIncludeType.dashboard) {
          dashboardCount++;
        }
      }
      if (dashboardCount > 0) {
        tabs.push({
          text: `Dashboards (${dashboardCount})`,
          icon: 'gicon gicon-dashboard',
          url: path + '?tab=' + TAB_ID_DASHBOARDS,
          id: TAB_ID_DASHBOARDS,
        });
      }
    }
    if (!defaultTab) {
      defaultTab = tabs[0].id; // the first tab
    }

    const { meta } = plugin;
    const node = {
      text: meta.name,
      img: meta.info.logos.large,
      subTitle: meta.info.author.name,
      breadcrumbs: [{ title: 'Plugins', url: '/plugins' }],
      url: path,
      children: this.setActiveTab(query.tab as string, tabs, defaultTab),
    };

    this.setState({
      loading: false,
      plugin,
      defaultTab,
      nav: {
        node: node,
        main: node,
      },
    });
  }

  setActiveTab(tabId: string, tabs: NavModelItem[], defaultTabId: string): NavModelItem[] {
    let found = false;
    const selected = tabId || defaultTabId;
    const changed = tabs.map(tab => {
      const active = !found && selected === tab.id;
      if (active) {
        found = true;
      }
      return { ...tab, active };
    });
    if (!found) {
      changed[0].active = true;
    }
    return changed;
  }

  componentDidUpdate(prevProps: Props) {
    const prevTab = prevProps.query.tab as string;
    const tab = this.props.query.tab as string;
    if (prevTab !== tab) {
      // const {nav, defaultTab} = this.state;
      // const node = {
      //   ...nav.node,
      //   children:this.setActiveTab(tab,nav.node.children, defaultTab),
      // }
      // this.setState({
      //   nav: {
      //     node:node,
      //     main:node,
      //   }
      // });
      console.log('TAB Changed... but for some reason the whole page reloads too!');
    }
  }

  onSaveConfig = (options: PluginConfigSaveOptions) => {
    const { plugin } = this.state;

    if (options.hasOwnProperty('enable')) {
      console.log('TODO, enable!', plugin);
    }

    console.log('TODO, save config');

    if (options.onAfterSave) {
      options.onAfterSave();
    }
  };

  renderBody() {
    const { query } = this.props;
    const { plugin, nav } = this.state;

    if (!plugin) {
      return <div>Plugin not found.</div>;
    }

    const active = nav.main.children.find(tab => tab.active);
    if (active) {
      // Find the current config tab
      if (plugin.configTabs) {
        for (const tab of plugin.configTabs) {
          if (tab.id === active.id) {
            return <tab.body meta={plugin.meta} query={query} onConfigSave={this.onSaveConfig} />;
          }
        }
      }
      if (active.id === TAB_ID_DASHBOARDS) {
        return <div>TODO Load Dashboards</div>;
      }
    }

    // Show the readme help text
    return <PluginHelp plugin={plugin.meta} type="help" />;
  }

  renderSidebar() {
    const { plugin } = this.state;

    return <div> TODO, sidebar... {plugin.meta.name} </div>;
  }

  render() {
    const { loading, nav } = this.state;
    return (
      <Page navModel={nav}>
        <Page.Contents isLoading={loading}>
          {!loading && (
            <div className="sidebar-container">
              <div className="sidebar-content">{this.renderBody()}</div>
              <aside className="page-sidebar">
                <section className="page-sidebar-section">{this.renderSidebar()}</section>
              </aside>
            </div>
          )}
        </Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  pluginId: state.location.routeParams.pluginId,
  query: state.location.query,
  path: state.location.path,
});

export default hot(module)(connect(mapStateToProps)(PluginConfigPage));
