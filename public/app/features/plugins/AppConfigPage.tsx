// Libraries
import React, { Component } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';

// Types
import { StoreState, NavModel, NavModelItem } from 'app/types';

import Page from 'app/core/components/Page/Page';

import { State as LoadignState, loadAppPluginForPage } from './AppPageWrapper';

interface Props {
  pluginId: string;
  tab?: string;
  path: string;
}

interface State extends LoadignState {
  tabs: NavModelItem[];
  defaultIndex: number;
}

class AppConfigPage extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      loading: true,
      tabs: [],
      defaultIndex: 0,
    };
  }

  async componentDidMount() {
    const { pluginId, path } = this.props;
    const info = await loadAppPluginForPage(pluginId);
    const tabs: NavModelItem[] = [];
    let defaultIndex = 0;
    if (info.plugin) {
      if (true) {
        tabs.push({
          text: 'REAME',
          icon: 'fa fa-fw fa-file-text-o',
          url: path + '?tab=readme',
          id: 'readme',
        });
      }
      tabs.push({
        text: 'Config',
        icon: 'gicon gicon-cog',
        url: path,
        id: 'config',
      });
      defaultIndex = tabs.length - 1;

      if (info.plugin.configTabs) {
        for (const tab of info.plugin.configTabs) {
          tabs.push({
            text: tab.title,
            subTitle: tab.subTitle,
            icon: tab.icon,
            url: path + '?tab=' + tab.title,
            id: tab.title,
          });
        }
      }
    }
    this.setState({ ...info, tabs, defaultIndex });
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.tab !== prevProps.tab) {
      console.log('Change Tab: ', this.props.tab);
    }
  }

  getNavModel(): NavModel {
    const { tab, path } = this.props;
    const { loading, plugin, tabs, defaultIndex } = this.state;
    if (plugin) {
      let count = 0;
      for (const nav of tabs) {
        nav.active = tab === nav.id;
        if (nav.active) {
          count++;
        }
      }
      if (count < 1 && tabs.length) {
        tabs[defaultIndex].active = true;
      }

      const { meta } = plugin;
      const node = {
        text: meta.name,
        img: meta.info.logos.large,
        subTitle: meta.info.author.name,
        breadcrumbs: [{ title: 'Plugins', url: '/plugins' }],
        url: path,
        children: tabs,
      };
      return {
        node: node,
        main: node,
      };
    }
    const item = loading
      ? {
          text: 'Loading',
          icon: 'fa fa-fw fa-spinner fa-spin',
        }
      : {
          text: 'Unkown Plugin',
          icon: 'fa fa-fw fa-warning',
          subTitle: '404 Error',
        };
    return {
      node: item,
      main: item,
    };
  }

  getBodyComponent() {
    const { tab } = this.props;
    const { plugin } = this.state;

    if (!tab || tab === 'config') {
      return plugin.configPage.body;
    }

    if (plugin.configTabs) {
      for (const t of plugin.configTabs) {
        if (tab === t.title) {
          return t.body;
        }
      }
    }

    console.log('NOT FOUND', tab);

    return plugin.configPage.body;
  }

  renderBody() {
    const { plugin } = this.state;
    if (!plugin) {
      return <div>Not found...</div>;
    }

    const Body = this.getBodyComponent();
    return (
      <Body
        plugin={this.state.plugin}
        onConfigSave={this.onConfigSave}
        beforeConfigSaved={this.beforeConfigSaved}
        afterConfigSaved={this.afterConfigSaved}
      />
    );
  }

  onConfigSave = () => {
    console.log('TODO, save config');
  };

  beforeConfigSaved = () => {
    console.log('TODO, beforeConfigSaved');
  };
  afterConfigSaved = () => {
    console.log('TODO, afterConfigSaved');
  };

  render() {
    const { loading } = this.state;
    return (
      <Page navModel={this.getNavModel()}>
        <Page.Contents isLoading={loading}>{!loading && <div>{this.renderBody()}</div>}</Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  pluginId: state.location.routeParams.pluginId,
  tab: state.location.query.tab,
  path: state.location.path,
});

export default hot(module)(connect(mapStateToProps)(AppConfigPage));
