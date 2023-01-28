// Libraries
import { AnyAction, createSlice, PayloadAction } from '@reduxjs/toolkit';
import React, { useCallback, useEffect, useMemo, useReducer } from 'react';
import { createHtmlPortalNode, InPortal, OutPortal } from 'react-reverse-portal';
import { useLocation, useRouteMatch } from 'react-router-dom';

import { AppEvents, AppPlugin, AppPluginMeta, NavModel, NavModelItem, PluginType } from '@grafana/data';
import { config, locationSearchToObject } from '@grafana/runtime';
import { getNotFoundNav, getWarningNav, getExceptionNav } from 'app/angular/services/nav_model_srv';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { appEvents } from 'app/core/core';

import { getPluginSettings } from '../pluginSettings';
import { importAppPlugin } from '../plugin_loader';
import { buildPluginSectionNav } from '../utils';

import { buildPluginPageContext, PluginPageContext } from './PluginPageContext';

interface Props {
  // The ID of the plugin we would like to load and display
  pluginId: string;
  // The root navModelItem for the plugin (root = lives directly under 'home')
  pluginNavSection: NavModelItem;
}

interface State {
  loading: boolean;
  plugin?: AppPlugin | null;
  // Used to display a tab navigation (used before the new Top Nav)
  pluginNav: NavModel | null;
}

const initialState: State = { loading: true, pluginNav: null, plugin: null };

export function AppRootPage({ pluginId, pluginNavSection }: Props) {
  const match = useRouteMatch();
  const location = useLocation();
  const [state, dispatch] = useReducer(stateSlice.reducer, initialState);
  const portalNode = useMemo(() => createHtmlPortalNode(), []);
  const currentUrl = config.appSubUrl + location.pathname + location.search;
  const { plugin, loading, pluginNav } = state;
  const navModel = buildPluginSectionNav(pluginNavSection, pluginNav, currentUrl);
  const queryParams = useMemo(() => locationSearchToObject(location.search), [location.search]);
  const context = useMemo(() => buildPluginPageContext(navModel), [navModel]);

  useEffect(() => {
    loadAppPlugin(pluginId, dispatch);
  }, [pluginId]);

  const onNavChanged = useCallback(
    (newPluginNav: NavModel) => dispatch(stateSlice.actions.changeNav(newPluginNav)),
    []
  );

  if (!plugin || pluginId !== plugin.meta.id) {
    return <Page navModel={navModel}>{loading && <PageLoader />}</Page>;
  }

  if (!plugin.root) {
    return (
      <Page navModel={navModel ?? getWarningNav('Plugin load error')}>
        <div>No root app page component found</div>
      </Page>
    );
  }

  const pluginRoot = plugin.root && (
    <plugin.root
      meta={plugin.meta}
      basename={match.url}
      onNavChanged={onNavChanged}
      query={queryParams}
      path={location.pathname}
    />
  );

  if (config.featureToggles.topnav && !pluginNav) {
    return <PluginPageContext.Provider value={context}>{pluginRoot}</PluginPageContext.Provider>;
  }

  return (
    <>
      <InPortal node={portalNode}>{pluginRoot}</InPortal>
      {navModel ? (
        <Page navModel={navModel} pageNav={pluginNav?.node}>
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

const stateSlice = createSlice({
  name: 'prom-builder-container',
  initialState: initialState,
  reducers: {
    setState: (state, action: PayloadAction<Partial<State>>) => {
      Object.assign(state, action.payload);
    },
    changeNav: (state, action: PayloadAction<NavModel>) => {
      let pluginNav = action.payload;
      // This is to hide the double breadcrumbs the old nav model can cause
      if (pluginNav && pluginNav.node.children) {
        pluginNav = {
          ...pluginNav,
          node: {
            ...pluginNav.main,
            // Because breadcumbs code is also used to set title when topnav should only set hideFromBreadcrumbs when topnav is enabled
            hideFromBreadcrumbs: config.featureToggles.topnav,
          },
        };
      }
      state.pluginNav = pluginNav;
    },
  },
});

async function loadAppPlugin(pluginId: string, dispatch: React.Dispatch<AnyAction>) {
  try {
    const app = await getPluginSettings(pluginId).then((info) => {
      const error = getAppPluginPageError(info);
      if (error) {
        appEvents.emit(AppEvents.alertError, [error]);
        dispatch(stateSlice.actions.setState({ pluginNav: getWarningNav(error) }));
        return null;
      }
      return importAppPlugin(info);
    });
    dispatch(stateSlice.actions.setState({ plugin: app, loading: false, pluginNav: null }));
  } catch (err) {
    dispatch(
      stateSlice.actions.setState({
        plugin: null,
        loading: false,
        pluginNav: process.env.NODE_ENV === 'development' ? getExceptionNav(err) : getNotFoundNav(),
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
