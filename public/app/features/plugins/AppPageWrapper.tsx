// Libraries
import React, { Component } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';

// Types
import { StoreState, NavModel, UrlQueryMap } from 'app/types';

import Page from 'app/core/components/Page/Page';
import { getPluginSettings } from './PluginSettingsCache';
import { importAppPlugin } from './plugin_loader';
import { AppPlugin } from '@grafana/ui';

interface Props {
  pluginId: string; // From the angular router
  page?: string;
  query: UrlQueryMap;
  path: string;
}

export interface State {
  loading: boolean;
  plugin?: AppPlugin;
}

export function loadAppPluginForPage(pluginId: string): Promise<State> {
  return getPluginSettings(pluginId)
    .then(info => {
      if (!info || info.type !== 'app' || !info.enabled) {
        return { loading: false, plugin: null };
      }
      return importAppPlugin(info)
        .then(plugin => {
          return { loading: false, plugin };
        })
        .catch(err => {
          return { loading: false, plugin: null };
        });
    })
    .catch(reason => {
      // This happens if the plugin is unknown
      return { loading: false, plugin: null };
    });
}

class AppPageWrapper extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      loading: true,
    };
  }

  async componentDidMount() {
    const { pluginId } = this.props;
    this.setState(await loadAppPluginForPage(pluginId));
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.query !== prevProps.query) {
      console.log('QUERY changed', this.props.query);
    }
  }

  getNavModel(): NavModel {
    const { loading, plugin } = this.state;
    if (plugin) {
      const node = {
        text: 'TODO Get the nav model from the application',
        icon: 'fa fa-fw fa-info',
        subTitle: 'The App subtitle',
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
          text: 'Unkown App Plugin',
          icon: 'fa fa-fw fa-warning',
          subTitle: '404 Error',
        };
    return {
      node: item,
      main: item,
    };

    // getNotFoundNav() {
    // }

    // const item:NavModelItem = {
    //   text: 'Hello',
    //   subTitle: 'XXXXXX',
    //   url: '',
    //   id: 'xxx',
    //   icon: 'fa fa-help',
    //   active: true,
    //   children: [],
    // };

    // const main:NavModelItem = {
    //   hideFromTabs: true,
    //   icon: "gicon gicon-shield",
    //   id: "admin",
    //   text: "Server Admin",
    //   subTitle: 'XXXXXX',
    //   url: "/admin/users",
    //   children: [item],
    // }

    // return {
    //   main: main,
    //   node: item,
    // };
  }

  onNavChanged = (nav: any) => {
    console.log('TODO, update the nav from the page control', nav);
  };

  renderPageBody() {
    const { path, query, page } = this.props;
    const { plugin } = this.state;
    const { pages } = plugin;
    if (pages) {
      for (const p of pages) {
        if (p.path === page) {
          const { Body } = p;
          return <Body plugin={plugin} query={query} onNavChanged={this.onNavChanged} path={path} />;
        }
      }
    }
    return <div>Page Not Found: {page}</div>;
  }

  render() {
    const { loading, plugin } = this.state;
    return (
      <Page navModel={this.getNavModel()}>
        <Page.Contents isLoading={loading}>
          {!loading && <div>{plugin ? <div>{this.renderPageBody()}</div> : <div>not found...</div>}</div>}
        </Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  pluginId: state.location.routeParams.pluginId,
  page: state.location.routeParams.path,
  query: state.location.query,
  path: state.location.path,
});

export default hot(module)(connect(mapStateToProps)(AppPageWrapper));
