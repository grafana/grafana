// Libraries
import React, { Component } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
// Types
import { StoreState } from 'app/types';
import { AppEvents, AppPlugin, AppPluginMeta, NavModel, PluginType, UrlQueryMap } from '@grafana/data';

import { getPluginSettings } from './PluginSettingsCache';
import { importAppPlugin } from './plugin_loader';
import { getLoadingNav } from './PluginPage';
import { getNotFoundNav, getWarningNav } from 'app/core/nav_model_srv';
import { appEvents } from 'app/core/core';

// has no exports only sets components exported in grafana/data
import './PluginPageRouter';

interface Props {
  pluginId: string; // From the angular router
  query: UrlQueryMap;
  path: string;
  slug?: string;
}

interface State {
  loading: boolean;
  plugin?: AppPlugin | null;
  nav: NavModel;
}

export function getAppPluginPageError(meta: AppPluginMeta) {
  if (!meta) {
    return 'Unknown Plugin';
  }
  if (meta.type !== PluginType.app) {
    return 'Plugin must be an app';
  }
  if (!meta.enabled) {
    return 'Application Not Enabled';
  }
  return null;
}

class AppRootPage extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      loading: true,
      nav: getLoadingNav(),
    };
  }

  async componentDidMount() {
    const { pluginId } = this.props;

    try {
      const app = await getPluginSettings(pluginId).then(info => {
        const error = getAppPluginPageError(info);
        if (error) {
          appEvents.emit(AppEvents.alertError, [error]);
          this.setState({ nav: getWarningNav(error) });
          return null;
        }
        return importAppPlugin(info);
      });
      this.setState({ plugin: app, loading: false });
    } catch (err) {
      this.setState({ plugin: null, loading: false, nav: getNotFoundNav() });
    }
  }

  onNavChanged = (nav: NavModel) => {
    this.setState({ nav });
  };

  render() {
    const { path, query } = this.props;
    const { plugin } = this.state;

    if (!plugin) {
      return <div>Loading</div>;
    }

    const AppRootPage = plugin.root;
    if (!AppRootPage) {
      return <div>No react root app page</div>;
    }

    return <AppRootPage meta={plugin.meta} query={query} path={path} />;
  }
}

const mapStateToProps = (state: StoreState) => ({
  pluginId: state.location.routeParams.pluginId,
  slug: state.location.routeParams.slug,
  query: state.location.query,
  path: state.location.path,
});

export default hot(module)(connect(mapStateToProps)(AppRootPage));
