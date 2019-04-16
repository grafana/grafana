// Libraries
import React, { Component } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';

// Types
import { StoreState, NavModel, NavModelItem } from 'app/types';
import { importAppPlugin } from './plugin_loader';
import { AppPlugin } from '@grafana/ui';
import { getPluginSettings } from './PluginSettingsCache';

import Page from 'app/core/components/Page/Page';

interface Props {
  pluginId: string;
  tab?: string;
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

class AppConfigPage extends Component<Props, State> {
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
    if (this.props.tab !== prevProps.tab) {
      console.log('Change Tab: ', this.props.tab);
    }
  }

  getNavModel(): NavModel {
    const { tab } = this.props;
    const { loading, plugin } = this.state;
    if (plugin) {
      const url = `/plugins/${plugin.meta.id}/config`;
      const children: NavModelItem[] = [];
      children.push({
        text: 'REAME',
        icon: 'fa fa-fw fa-file-text-o',
        url: url + '?tab=readme',
        active: tab === 'readme',
      });
      children.push({
        text: 'Config',
        icon: 'gicon gicon-cog',
        url: url + '?tab=config',
        active: !tab || tab === 'config',
      });

      const { meta } = plugin;
      const node = {
        text: meta.name,
        img: meta.info.logos.large,
        subTitle: meta.info.author.name,
        breadcrumbs: [{ title: 'Plugins', url: '/plugins' }],
        url,
        children,
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

  render() {
    const { loading, plugin } = this.state;

    return (
      <Page navModel={this.getNavModel()}>
        <Page.Contents isLoading={loading}>
          {!loading && <div>{plugin ? <div>HELLO: {plugin.meta.id}</div> : <div>not found...</div>}</div>}
        </Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  pluginId: state.location.routeParams.pluginId,
  tab: state.location.query.tab,
});

export default hot(module)(connect(mapStateToProps)(AppConfigPage));
