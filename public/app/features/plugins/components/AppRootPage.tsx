// Libraries
import { type AnyAction, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { Suspense, useCallback, useEffect, useMemo, useReducer } from 'react';
import * as React from 'react';
import { useLocation, useParams } from 'react-router-dom-v5-compat';

import {
  AppEvents,
  type AppPlugin,
  type AppPluginMeta,
  type NavModel,
  type NavModelItem,
  OrgRole,
  PluginType,
  PluginContextProvider,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, isFetchError, locationSearchToObject } from '@grafana/runtime';
import { getLogger } from '@grafana/runtime/unstable';
import { Alert, ErrorWithStack } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { getNotFoundNav, getWarningNav, getExceptionNav } from 'app/core/navigation/errorModels';
import { contextSrv } from 'app/core/services/context_srv';
import { getMessageFromError } from 'app/core/utils/errors';
import { AccessControlAction } from 'app/types/accessControl';

import {
  ExtensionRegistriesProvider,
  useAddedLinksRegistry,
  useAddedComponentsRegistry,
  useExposedComponentsRegistry,
  useAddedFunctionsRegistry,
} from '../extensions/ExtensionRegistriesContext';
import { pluginImporter } from '../importer/pluginImporter';
import { getPluginSettings } from '../pluginSettings';
import { buildPluginSectionNav } from '../utils';

import { PluginErrorBoundary } from './PluginErrorBoundary';
import { buildPluginPageContext, PluginPageContext } from './PluginPageContext';
import { pluginNavFallbacks } from './pluginNavFallbacks';
import { RestrictedGrafanaApisProvider } from './restrictedGrafanaApis/RestrictedGrafanaApisProvider';

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
  // HTTP status from a settings fetch failure, if any. Only a 404 is interpreted as "plugin is not
  // installed" and triggers a registered fallback; other failures (401/403/5xx/network/import) keep
  // the existing not-found UI and re-emit a user-facing alert so backend errors don't silently
  // morph into the onboarding stub.
  errorStatus?: number;
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
  const { plugin, loading, loadingError, errorStatus, pluginNav } = state;
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
    // Only render a registered fallback when the settings fetch returned 404 — that is the genuine
    // "plugin is not installed" signal. Other failures (auth, server, import) keep the not-found UI
    // and the user gets a real toast (re-emitted in loadAppPlugin's catch).
    //
    // Also gate on plugins:install. Fallbacks are conceptually onboarding screens that direct the
    // user to install; for users without that permission we fall through to the standard not-found
    // UI so this matches how every other unavailable plugin URL behaves in Grafana.
    const canInstallPlugins = contextSrv.hasPermission(AccessControlAction.PluginsInstall);
    const FallbackComponent =
      !loading && loadingError && errorStatus === 404 && canInstallPlugins ? pluginNavFallbacks[pluginId] : undefined;
    return (
      <Page navModel={navModel} pageNav={{ text: '' }} layout={currentLayout}>
        {loading && <PageLoader />}
        {!loading && loadingError && FallbackComponent && (
          <Suspense fallback={<PageLoader />}>
            <FallbackComponent />
          </Suspense>
        )}
        {!loading && loadingError && !FallbackComponent && <EntityNotFound entity="App" />}
      </Page>
    );
  }

  if (!plugin.root) {
    return (
      <Page navModel={navModel ?? getWarningNav('Plugin load error')}>
        <div>
          <Trans i18nKey="plugins.app-root-page.no-root-app-page-component-found">
            No root app page component found
          </Trans>
        </div>
      </Page>
    );
  }

  const pluginRoot = plugin.root && (
    <PluginContextProvider meta={plugin.meta}>
      <PluginErrorBoundary
        fallback={({ error, errorInfo }) => (
          <ErrorWithStack
            title={t('plugins.app-root-page.error-loading-plugin', 'Plugin failed to load')}
            error={error}
            errorInfo={errorInfo}
          />
        )}
      >
        <RestrictedGrafanaApisProvider pluginId={pluginId}>
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
        </RestrictedGrafanaApisProvider>
      </PluginErrorBoundary>
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
      <Alert severity="warning" title={t('plugins.app-root-page.access-denied.title-access-denied', 'Access denied')}>
        <Trans i18nKey="plugins.app-root-page.access-denied.permission">
          You do not have permission to see this page.
        </Trans>
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
  // For plugins with a registered nav fallback, the dummy fallback component IS the inline error UI
  // for the "plugin is not installed" (404) case, so the backend's auto-toast there is just redundant
  // noise. Suppressing it follows the same pattern Login uses. Failures other than 404 are NOT silent
  // — we re-emit the alert from the catch block so backend errors still surface to the user.
  const hasFallback = pluginNavFallbacks[pluginId] !== undefined;
  const settingsRequestOptions = hasFallback ? { showErrorAlert: false } : undefined;
  try {
    const app = await getPluginSettings(pluginId, settingsRequestOptions).then((info) => {
      const error = getAppPluginPageError(info);
      if (error) {
        appEvents.emit(AppEvents.alertError, [error]);
        dispatch(stateSlice.actions.setState({ pluginNav: getWarningNav(error) }));
        return null;
      }
      return pluginImporter.importApp(info);
    });
    dispatch(
      stateSlice.actions.setState({
        plugin: app,
        loading: false,
        loadingError: false,
        errorStatus: undefined,
        pluginNav: null,
      })
    );
  } catch (err) {
    const errorStatus = isFetchError(err) ? err.status : undefined;
    // We suppressed the auto-toast assuming a 404. Anything else (401/403/5xx, network, import error)
    // must still produce a user-visible alert — otherwise a real backend failure silently morphs into
    // the onboarding fallback and the user has no idea why nothing works.
    if (hasFallback && errorStatus !== 404) {
      appEvents.emit(AppEvents.alertError, [getMessageFromError(err)]);
    }
    dispatch(
      stateSlice.actions.setState({
        plugin: null,
        loading: false,
        loadingError: true,
        errorStatus,
        pluginNav: process.env.NODE_ENV === 'development' ? getExceptionNav(err) : getNotFoundNav(),
      })
    );
    const error = err instanceof Error ? err : new Error(getMessageFromError(err));
    getLogger('features.plugins').logError(error);
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
