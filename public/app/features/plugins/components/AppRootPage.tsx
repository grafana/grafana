// Libraries
import { AnyAction, createSlice, PayloadAction } from '@reduxjs/toolkit';
import React, { useEffect, useReducer } from 'react';
import { createHtmlPortalNode, InPortal, OutPortal } from 'react-reverse-portal';

import { AppEvents, AppPlugin, AppPluginMeta, KeyValue, NavModel, PluginType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { getNotFoundNav, getWarningNav, getExceptionNav } from 'app/angular/services/nav_model_srv';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { appEvents } from 'app/core/core';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { getPluginSettings } from '../pluginSettings';
import { importAppPlugin } from '../plugin_loader';
interface RouteParams {
  pluginId: string;
}

interface Props extends GrafanaRouteComponentProps<RouteParams> {}

interface State {
  loading: boolean;
  plugin?: AppPlugin | null;
  nav?: NavModel;
}

export function AppRootPage({ match, queryParams, location }: Props) {
  const [state, dispatch] = useReducer(stateSlice.reducer, { loading: true });
  const portalNode = React.useMemo(() => createHtmlPortalNode(), []);
  const { plugin, loading, nav } = state;

  // Only rebuild visual query if expr changes from outside
  useEffect(() => {
    loadAppPlugin(match.params.pluginId, dispatch);
  }, [match.params.pluginId]);

  if (!plugin) {
    return <Page navId="apps">{loading && <PageLoader />}</Page>;
  }

  if (!plugin.root) {
    <Page navId="apps">
      <div>No root App</div>;
    </Page>;
  }

  const pluginRoot = (
    <plugin.root
      meta={plugin.meta}
      basename={match.url}
      onNavChanged={(newNav: NavModel) => dispatch(stateSlice.actions.changeNav(newNav))}
      query={queryParams as KeyValue}
      path={location.pathname}
    />
  );

  if (config.featureToggles.topnav && !nav) {
    return pluginRoot;
  }

  return (
    <>
      <InPortal node={portalNode}>{pluginRoot}</InPortal>
      {nav ? (
        <Page navModel={nav}>
          <Page.Contents isLoading={loading}>
            <OutPortal node={portalNode} />
          </Page.Contents>
        </Page>
      ) : (
        <Page>
          <OutPortal node={portalNode} />
        </Page>
      )}
    </>
  );
}

const initialState: State = { loading: true };

const stateSlice = createSlice({
  name: 'prom-builder-container',
  initialState: initialState,
  reducers: {
    setState: (state, action: PayloadAction<Partial<State>>) => {
      Object.assign(state, action.payload);
    },
    changeNav: (state, action: PayloadAction<NavModel>) => {
      state.nav = action.payload;
    },
  },
});

async function loadAppPlugin(pluginId: string, dispatch: React.Dispatch<AnyAction>) {
  try {
    const app = await getPluginSettings(pluginId).then((info) => {
      const error = getAppPluginPageError(info);
      if (error) {
        appEvents.emit(AppEvents.alertError, [error]);
        dispatch(stateSlice.actions.setState({ nav: getWarningNav(error) }));
        return null;
      }
      return importAppPlugin(info);
    });
    dispatch(stateSlice.actions.setState({ plugin: app, loading: false, nav: undefined }));
  } catch (err) {
    dispatch(
      stateSlice.actions.setState({
        plugin: null,
        loading: false,
        nav: process.env.NODE_ENV === 'development' ? getExceptionNav(err) : getNotFoundNav(),
      })
    );
  }
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

export default AppRootPage;
