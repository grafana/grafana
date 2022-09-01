// Libraries
import { AnyAction, createSlice, PayloadAction } from '@reduxjs/toolkit';
import * as H from 'history';
import React, { useCallback, useEffect, useMemo, useReducer } from 'react';
import { createHtmlPortalNode, InPortal, OutPortal } from 'react-reverse-portal';
import { createSelector } from 'reselect';

import {
  AppEvents,
  AppPlugin,
  AppPluginMeta,
  KeyValue,
  NavIndex,
  NavModel,
  NavModelItem,
  PluginType,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { getNotFoundNav, getWarningNav, getExceptionNav } from 'app/angular/services/nav_model_srv';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { appEvents } from 'app/core/core';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState, useSelector } from 'app/types';

import { getPluginSettings } from '../pluginSettings';
import { importAppPlugin } from '../plugin_loader';

import { buildPluginPageContext, PluginPageContext } from './PluginPageContext';

interface RouteParams {
  pluginId: string;
}

interface Props extends GrafanaRouteComponentProps<RouteParams> {}

interface State {
  loading: boolean;
  plugin?: AppPlugin | null;
  pluginNav: NavModel | null;
}

const initialState: State = { loading: true, pluginNav: null, plugin: null };

export function AppRootPage({ match, queryParams, location }: Props) {
  const [state, dispatch] = useReducer(stateSlice.reducer, initialState);
  const portalNode = useMemo(() => createHtmlPortalNode(), []);
  const { plugin, loading, pluginNav } = state;
  const sectionNav = useSelector(
    createSelector(getNavIndex, (navIndex) => buildPluginSectionNav(location, pluginNav, navIndex))
  );
  const context = useMemo(() => buildPluginPageContext(sectionNav), [sectionNav]);

  useEffect(() => {
    loadAppPlugin(match.params.pluginId, dispatch);
  }, [match.params.pluginId]);

  const onNavChanged = useCallback(
    (newPluginNav: NavModel) => dispatch(stateSlice.actions.changeNav(newPluginNav)),
    []
  );

  if (!plugin || match.params.pluginId !== plugin.meta.id) {
    return <Page navId="apps">{loading && <PageLoader />}</Page>;
  }

  if (!plugin.root) {
    return (
      <Page navId="apps">
        <div>No root app page component found</div>;
      </Page>
    );
  }

  const pluginRoot = plugin.root && (
    <plugin.root
      meta={plugin.meta}
      basename={match.url}
      onNavChanged={onNavChanged}
      query={queryParams as KeyValue}
      path={location.pathname}
    />
  );

  if (config.featureToggles.topnav && !pluginNav) {
    return <PluginPageContext.Provider value={context}>{pluginRoot}</PluginPageContext.Provider>;
  }

  return (
    <>
      <InPortal node={portalNode}>{pluginRoot}</InPortal>
      {sectionNav ? (
        <Page navModel={sectionNav} pageNav={pluginNav?.node}>
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

function buildPluginSectionNav(location: H.Location, pluginNav: NavModel | null, navIndex: NavIndex) {
  // When topnav is disabled we only just show pluginNav like before
  if (!config.featureToggles.topnav) {
    return pluginNav;
  }

  const originalSection = getNavModel(navIndex, 'apps').main;
  const section = { ...originalSection };

  const currentUrl = config.appSubUrl + location.pathname + location.search;
  let activePage: NavModelItem | undefined;

  // Set active page
  section.children = (section?.children ?? []).map((child) => {
    if (child.children) {
      return {
        ...child,
        children: child.children.map((pluginPage) => {
          if (currentUrl.startsWith(pluginPage.url ?? '')) {
            activePage = {
              ...pluginPage,
              active: true,
            };
            return activePage;
          }
          return pluginPage;
        }),
      };
    }
    return child;
  });

  return { main: section, node: activePage ?? section };
}

const stateSlice = createSlice({
  name: 'prom-builder-container',
  initialState: initialState,
  reducers: {
    setState: (state, action: PayloadAction<Partial<State>>) => {
      Object.assign(state, action.payload);
    },
    changeNav: (state, action: PayloadAction<NavModel>) => {
      state.pluginNav = action.payload;
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

function getNavIndex(store: StoreState) {
  return store.navIndex;
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
