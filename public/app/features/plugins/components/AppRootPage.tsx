// Libraries
import { AnyAction, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { useCallback, useEffect, useMemo, useReducer } from 'react';
import * as React from 'react';
import { useLocation, useParams } from 'react-router-dom-v5-compat';

import {
  AppEvents,
  AppPlugin,
  AppPluginMeta,
  NavModel,
  NavModelItem,
  OrgRole,
  PluginType,
  PluginContextProvider,
} from '@grafana/data';
import { config, locationSearchToObject } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { appEvents, contextSrv } from 'app/core/core';
import { getNotFoundNav, getWarningNav, getExceptionNav } from 'app/core/navigation/errorModels';
import { getMessageFromError } from 'app/core/utils/errors';

import {
  ExtensionRegistriesProvider,
  useAddedLinksRegistry,
  useAddedComponentsRegistry,
  useExposedComponentsRegistry,
  useAddedFunctionsRegistry,
} from '../extensions/ExtensionRegistriesContext';
import { getPluginSettings } from '../pluginSettings';
import { importAppPlugin } from '../plugin_loader';
import { buildPluginSectionNav, pluginsLogger } from '../utils';

import { buildPluginPageContext, PluginPageContext } from './PluginPageContext';

interface Props {
  // The ID of the plugin we would like to load and display
  pluginId?: string;
  // The root navModelItem for the plugin (root = lives directly under 'home'). In case app does not need a nva model,
  // for example it's in some way embedded or shown in a sideview this can be undefined.
  pluginNavSection?: NavModelItem;
}

interface State {
  loading: boolean;
  loadingError: boolean;
  plugin?: AppPlugin | null;
  // Used to display a tab navigation (used before the new Top Nav)
  pluginNav: NavModel | null;
}

const initialState: State = { loading: true, loadingError: false, pluginNav: null, plugin: null };

export function AppRootPage({ pluginId, pluginNavSection }: Props) {
  const { pluginId: pluginIdParam = '' } = useParams();
  pluginId = pluginId || pluginIdParam;
  const addedLinksRegistry = useAddedLinksRegistry();
  const addedComponentsRegistry = useAddedComponentsRegistry();
  const exposedComponentsRegistry = useExposedComponentsRegistry();
  const addedFunctionsRegistry = useAddedFunctionsRegistry();
  const location = useLocation();
  const [state, dispatch] = useReducer(stateSlice.reducer, initialState);
  const currentUrl = config.appSubUrl + location.pathname + location.search;
  const { plugin, loading, loadingError, pluginNav } = state;
  const navModel = buildPluginSectionNav(currentUrl, pluginNavSection);
  const queryParams = useMemo(() => locationSearchToObject(location.search), [location.search]);
  const context = useMemo(() => buildPluginPageContext(navModel), [navModel]);
  const grafanaContext = useGrafana();

  useEffect(() => {
    loadAppPlugin(pluginId, dispatch);
  }, [pluginId]);

  const onNavChanged = useCallback(
    (newPluginNav: NavModel) => dispatch(stateSlice.actions.changeNav(newPluginNav)),
    []
  );

  if (!plugin || pluginId !== plugin.meta.id) {
    // Use current layout while loading to reduce flickering
    const currentLayout = grafanaContext.chrome.state.getValue().layout;
    return (
      <Page navModel={navModel} pageNav={{ text: '' }} layout={currentLayout}>
        {loading && <PageLoader />}
        {!loading && loadingError && <EntityNotFound entity="App" />}
      </Page>
    );
  }

  if (!plugin.root) {
    return (
      <Page navModel={navModel ?? getWarningNav('Plugin load error')}>
        <div>No root app page component found</div>
      </Page>
    );
  }

  const pluginRoot = plugin.root && (
    <PluginContextProvider meta={plugin.meta}>
      <ExtensionRegistriesProvider
        registries={{
          addedLinksRegistry: addedLinksRegistry.readOnly(),
          addedComponentsRegistry: addedComponentsRegistry.readOnly(),
          exposedComponentsRegistry: exposedComponentsRegistry.readOnly(),
          addedFunctionsRegistry: addedFunctionsRegistry.readOnly(),
        }}
      >
        <plugin.root
          meta={plugin.meta}
          basename={location.pathname}
          onNavChanged={onNavChanged}
          query={queryParams}
          path={location.pathname}
        />
      </ExtensionRegistriesProvider>
    </PluginContextProvider>
  );

  // Because of the fallback at plugin routes, we need to check
  // if the user has permissions to see the plugin page.
  const userHasPermissionsToPluginPage = () => {
    // Check if plugin does not have any configurations or the user is Grafana Admin
    if (!plugin.meta?.includes) {
      return true;
    }

    const pluginInclude = plugin.meta?.includes.find((include) => include.path === location.pathname);
    // Check if include configuration contains current path
    if (!pluginInclude) {
      return true;
    }

    // Check if action exists and give access if user has the required permission.
    if (pluginInclude?.action) {
      return contextSrv.hasPermission(pluginInclude.action);
    }

    if (contextSrv.isGrafanaAdmin || contextSrv.user.orgRole === OrgRole.Admin) {
      return true;
    }

    const pathRole: string = pluginInclude?.role || '';
    // Check if role exists  and give access to Editor to be able to see Viewer pages
    if (!pathRole || (contextSrv.isEditor && pathRole === OrgRole.Viewer)) {
      return true;
    }
    return contextSrv.hasRole(pathRole);
  };

  const AccessDenied = () => {
    return (
      <Alert severity="warning" title="Access denied">
        You do not have permission to see this page.
      </Alert>
    );
  };

  if (!userHasPermissionsToPluginPage()) {
    return <AccessDenied />;
  }

  if (!pluginNav) {
    return <PluginPageContext.Provider value={context}>{pluginRoot}</PluginPageContext.Provider>;
  }

  return (
    <>
      {navModel ? (
        <Page navModel={navModel} pageNav={pluginNav?.node}>
          <Page.Contents isLoading={loading}>{pluginRoot}</Page.Contents>
        </Page>
      ) : (
        <Page>{pluginRoot}</Page>
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
            hideFromBreadcrumbs: true,
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
    dispatch(stateSlice.actions.setState({ plugin: app, loading: false, loadingError: false, pluginNav: null }));
  } catch (err) {
    dispatch(
      stateSlice.actions.setState({
        plugin: null,
        loading: false,
        loadingError: true,
        pluginNav: process.env.NODE_ENV === 'development' ? getExceptionNav(err) : getNotFoundNav(),
      })
    );
    const error = err instanceof Error ? err : new Error(getMessageFromError(err));
    pluginsLogger.logError(error);
    console.error(error);
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
