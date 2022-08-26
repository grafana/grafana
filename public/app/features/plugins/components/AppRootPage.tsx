// Libraries
import { AnyAction, createSlice, PayloadAction } from '@reduxjs/toolkit';
import React, { useCallback, useEffect, useReducer } from 'react';
import { createHtmlPortalNode, InPortal, OutPortal } from 'react-reverse-portal';
import { createSelector } from 'reselect';

import { AppEvents, AppPlugin, AppPluginMeta, KeyValue, NavModel, PluginType } from '@grafana/data';
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
  const portalNode = React.useMemo(() => createHtmlPortalNode(), []);
  const { plugin, loading, pluginNav } = state;
  const sectionNav = useSelector(createSelector(getNavIndex, (navIndex) => getNavModel(navIndex, 'apps')));

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
    return pluginRoot;
  }

  const finalNav = addSectionNav(pluginNav, sectionNav);

  return (
    <>
      <InPortal node={portalNode}>{pluginRoot}</InPortal>
      {finalNav ? (
        <Page navModel={finalNav}>
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

function addSectionNav(pluginNav: NavModel | null, sectionNav: NavModel) {
  // When topnav is disabled we only just show pluginNav like before
  if (!config.featureToggles.topnav) {
    return pluginNav;
  }

  if (!pluginNav) {
    return sectionNav;
  }

  return sectionNav;
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
