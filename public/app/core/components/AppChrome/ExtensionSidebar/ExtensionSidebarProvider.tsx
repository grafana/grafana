import { createContext, type ReactNode, useCallback, useContext, useEffect, useState, useMemo } from 'react';
import { useAsync, useLocalStorage } from 'react-use';

import { PluginExtensionPoints, store } from '@grafana/data';
import {
  getAppEvents,
  reportInteraction,
  usePluginComponents,
  usePluginLinks,
  locationService,
} from '@grafana/runtime';
import { type ExtensionPointPluginMeta } from 'app/features/plugins/extensions/appUtils';
import { getExtensionPointPluginMeta } from 'app/features/plugins/extensions/utils';
import { CloseExtensionSidebarEvent, OpenExtensionSidebarEvent, ToggleExtensionSidebarEvent } from 'app/types/events';

import { DEFAULT_EXTENSION_SIDEBAR_WIDTH, MAX_EXTENSION_SIDEBAR_WIDTH, MIN_EXTENSION_SIDEBAR_WIDTH } from './constants';
import {
  EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY,
  EXTENSION_SIDEBAR_URL_PARAM,
  getComponentIdFromUrlValue,
  getComponentMetaFromComponentId,
  getComponentUrlValue,
} from './extensionSidebarUtils';

const EXTENSION_SIDEBAR_WIDTH_LOCAL_STORAGE_KEY = 'grafana.navigation.extensionSidebarWidth';
const PERMITTED_EXTENSION_SIDEBAR_PLUGINS = [
  'grafana',
  'grafana-assistant-app',
  'grafana-assistant-onboarding-app',
  'grafana-dash-app',
  // The docs plugin ID is transitioning from grafana-grafanadocsplugin-app to grafana-pathfinder-app.
  // Support both until that migration is complete.
  'grafana-grafanadocsplugin-app',
  'grafana-pathfinder-app',
  'grafana-grotfood-app',
];

export type ExtensionSidebarContextType = {
  /**
   * Whether the extension sidebar is open.
   */
  isOpen: boolean;
  /**
   * The id of the component that is currently docked in the sidebar. If the id is undefined, nothing will be rendered.
   */
  dockedComponentId: string | undefined;
  /**
   * Sest the id of the component that will be rendered in the extension sidebar.
   */
  setDockedComponentId: (componentId: string | undefined) => void;
  /**
   * A map of all components that are available for the extension point.
   */
  availableComponents: ExtensionPointPluginMeta;
  /**
   * The width of the extension sidebar.
   */
  extensionSidebarWidth: number;
  /**
   * Set the width of the extension sidebar.
   */
  setExtensionSidebarWidth: (width: number) => void;

  props?: Record<string, unknown>;
};

const ExtensionSidebarContext = createContext<ExtensionSidebarContextType>({
  isOpen: false,
  dockedComponentId: undefined,
  setDockedComponentId: () => {},
  availableComponents: new Map(),
  extensionSidebarWidth: DEFAULT_EXTENSION_SIDEBAR_WIDTH,
  setExtensionSidebarWidth: () => {},
});

export function useExtensionSidebarContext() {
  return useContext(ExtensionSidebarContext);
}

interface ExtensionSidebarContextProps {
  children: ReactNode;
}

export const ExtensionSidebarContextProvider = ({ children }: ExtensionSidebarContextProps) => {
  const [props, setProps] = useState<Record<string, unknown> | undefined>(undefined);
  const storedDockedPluginId = store.get(EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY);
  const urlDockedComponentId = getComponentIdFromUrlValue(
    locationService.getSearchObject()[EXTENSION_SIDEBAR_URL_PARAM]
  );
  const [extensionSidebarWidth, setExtensionSidebarWidth] = useLocalStorage(
    EXTENSION_SIDEBAR_WIDTH_LOCAL_STORAGE_KEY,
    DEFAULT_EXTENSION_SIDEBAR_WIDTH
  );

  const [currentLocation, setCurrentLocation] = useState(locationService.getLocation());

  useEffect(() => {
    const subscription = locationService.getLocationObservable().subscribe((location) => {
      setCurrentLocation(location);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // these links are needed to conditionally render the extension component
  // that means, a plugin would need to register both, a link and a component to
  // `grafana/extension-sidebar/v0-alpha` and the link's `configure` method would control
  // whether the component is rendered or not
  const { links, isLoading: isPluginLinksLoading } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.ExtensionSidebar,
    context: {
      path: currentLocation.pathname,
    },
  });
  const { components, isLoading: isPluginComponentsLoading } = usePluginComponents({
    extensionPointId: PluginExtensionPoints.ExtensionSidebar,
  });

  const { loading: isExtensionPointPluginMetaLoading, value: pluginMap } = useAsync(() =>
    getExtensionPointPluginMeta(PluginExtensionPoints.ExtensionSidebar)
  );

  const isLoading = useMemo(
    () => isPluginLinksLoading || isPluginComponentsLoading || isExtensionPointPluginMetaLoading,
    [isPluginComponentsLoading, isPluginLinksLoading, isExtensionPointPluginMetaLoading]
  );

  // get all components for this extension point, but only for the permitted plugins
  // if the extension sidebar is not enabled, we will return an empty map
  const availableComponents = useMemo(() => {
    const available = new Map(
      Array.from(pluginMap?.entries() || []).filter(
        ([pluginId, pluginMeta]) =>
          PERMITTED_EXTENSION_SIDEBAR_PLUGINS.includes(pluginId) &&
          links.some(
            (link) =>
              link.pluginId === pluginId &&
              pluginMeta.addedComponents.some((component) => component.title === link.title)
          )
      )
    );

    const coreComponents = components
      .filter((component) => component.meta.pluginId === 'grafana')
      .filter((component) => links.some((link) => link.pluginId === 'grafana' && link.title === component.meta.title))
      .map((component) => ({
        targets: PluginExtensionPoints.ExtensionSidebar,
        title: component.meta.title,
        description: component.meta.description,
      }));

    if (coreComponents.length > 0) {
      available.set('grafana', { addedComponents: coreComponents, addedLinks: [] });
    }

    return available;
  }, [components, links, pluginMap]);

  // check if the stored docked component is still available
  let defaultDockedComponentId: string | undefined;
  const initialDockedComponentId = urlDockedComponentId ?? storedDockedPluginId;
  if (initialDockedComponentId) {
    const dockedMeta = getComponentMetaFromComponentId(initialDockedComponentId);
    if (dockedMeta) {
      defaultDockedComponentId = initialDockedComponentId;
    }
  }
  const [dockedComponentId, setDockedComponentState] = useState<string | undefined>(defaultDockedComponentId);

  const syncDockedComponentInUrl = useCallback((componentId: string | undefined) => {
    const urlValue = componentId ? getComponentUrlValue(componentId) : undefined;
    if (locationService.getSearchObject()[EXTENSION_SIDEBAR_URL_PARAM] !== urlValue) {
      locationService.partial({ [EXTENSION_SIDEBAR_URL_PARAM]: urlValue ?? null }, true);
    }
  }, []);

  const setDockedComponentId = useCallback(
    (componentId: string | undefined) => {
      setDockedComponentState(componentId);
      syncDockedComponentInUrl(componentId);
    },
    [syncDockedComponentInUrl]
  );

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (dockedComponentId) {
      const dockedMeta = getComponentMetaFromComponentId(dockedComponentId);
      if (dockedMeta) {
        const plugin = availableComponents.get(dockedMeta.pluginId);
        const componentAvailable = plugin?.addedComponents.some((c) => c.title === dockedMeta.componentTitle);
        const coreLinkStillAvailable =
          dockedMeta.pluginId === 'grafana' &&
          links.some((link) => link.pluginId === 'grafana' && link.title === dockedMeta.componentTitle);
        if (!componentAvailable && !coreLinkStillAvailable) {
          setDockedComponentState(undefined);
        }
      } else {
        // no component found, so we clear the docked component id
        setDockedComponentState(undefined);
      }
    }
  }, [isLoading, availableComponents, dockedComponentId, links]);

  useEffect(() => {
    if (isLoading || dockedComponentId) {
      return;
    }

    const requestedComponentId = getComponentIdFromUrlValue(
      locationService.getSearchObject()[EXTENSION_SIDEBAR_URL_PARAM]
    );
    const requestedMeta = requestedComponentId ? getComponentMetaFromComponentId(requestedComponentId) : undefined;
    if (
      requestedComponentId &&
      requestedMeta &&
      availableComponents
        .get(requestedMeta.pluginId)
        ?.addedComponents.some((component) => component.title === requestedMeta.componentTitle)
    ) {
      setDockedComponentState(requestedComponentId);
    }
  }, [availableComponents, dockedComponentId, isLoading]);

  useEffect(() => {
    if (isLoading || !dockedComponentId) {
      return;
    }

    const dockedMeta = getComponentMetaFromComponentId(dockedComponentId);
    const componentAvailable = dockedMeta
      ? availableComponents
          .get(dockedMeta.pluginId)
          ?.addedComponents.some((component) => component.title === dockedMeta.componentTitle)
      : false;

    if (componentAvailable) {
      syncDockedComponentInUrl(dockedComponentId);
    }
  }, [availableComponents, currentLocation, dockedComponentId, isLoading, syncDockedComponentInUrl]);

  const setDockedComponentWithProps = useCallback(
    (componentId: string | undefined, props?: Record<string, unknown>) => {
      setProps(props);
      setDockedComponentId(componentId);
    },
    [setDockedComponentId]
  );

  useEffect(() => {
    // handler to open the extension sidebar from plugins. this is done with the `helpers.openSidebar` function
    const openSidebarHandler = (event: OpenExtensionSidebarEvent) => {
      if (
        event.payload.pluginId &&
        event.payload.componentTitle &&
        PERMITTED_EXTENSION_SIDEBAR_PLUGINS.includes(event.payload.pluginId) &&
        availableComponents
          .get(event.payload.pluginId)
          ?.addedComponents.some((component) => component.title === event.payload.componentTitle)
      ) {
        setDockedComponentWithProps(
          JSON.stringify({ pluginId: event.payload.pluginId, componentTitle: event.payload.componentTitle }),
          event.payload.props
        );
      }
    };

    const closeSidebarHandler = () => {
      setDockedComponentId(undefined);
    };

    const toggleSidebarHandler = (event: ToggleExtensionSidebarEvent) => {
      const currentComponentMeta = getComponentMetaFromComponentId(dockedComponentId ?? '');
      const isCurrentlyOpen =
        currentComponentMeta?.pluginId === event.payload.pluginId &&
        currentComponentMeta?.componentTitle === event.payload.componentTitle;

      if (isCurrentlyOpen) {
        closeSidebarHandler();
      } else {
        openSidebarHandler(event);
      }
    };

    const openSubscription = getAppEvents().subscribe(OpenExtensionSidebarEvent, openSidebarHandler);
    const closeSubscription = getAppEvents().subscribe(CloseExtensionSidebarEvent, closeSidebarHandler);
    const toggleSubscription = getAppEvents().subscribe(ToggleExtensionSidebarEvent, toggleSidebarHandler);
    return () => {
      openSubscription.unsubscribe();
      closeSubscription.unsubscribe();
      toggleSubscription.unsubscribe();
    };
  }, [setDockedComponentWithProps, setDockedComponentId, availableComponents, dockedComponentId]);

  // update the stored docked component id when it changes
  useEffect(() => {
    // wait for the plugin links to be loaded before we update the stored docked component id
    if (isLoading) {
      return;
    }
    const componentMeta = getComponentMetaFromComponentId(dockedComponentId ?? '');
    const storedComponentId = store.get(EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY);
    const storedComponentMeta = getComponentMetaFromComponentId(storedComponentId ?? '');
    const opened = dockedComponentId !== undefined;
    // we either want to track opened events, or closed events when we have a previous component
    if (opened || storedComponentMeta) {
      reportInteraction('grafana_extension_sidebar_changed', {
        opened: opened,
        componentTitle: (opened ? componentMeta : storedComponentMeta)?.componentTitle,
        pluginId: (opened ? componentMeta : storedComponentMeta)?.pluginId,
        fromLocalstorage: storedComponentId === dockedComponentId,
      });
    }
    if (dockedComponentId) {
      store.set(EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY, dockedComponentId);
    } else {
      store.delete(EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY);
    }
  }, [dockedComponentId, isLoading]);

  return (
    <ExtensionSidebarContext.Provider
      value={{
        isOpen: dockedComponentId !== undefined,
        dockedComponentId,
        setDockedComponentId: (componentId) => setDockedComponentWithProps(componentId, undefined),
        availableComponents,
        extensionSidebarWidth: Math.min(
          Math.max(extensionSidebarWidth ?? DEFAULT_EXTENSION_SIDEBAR_WIDTH, MIN_EXTENSION_SIDEBAR_WIDTH),
          MAX_EXTENSION_SIDEBAR_WIDTH
        ),
        setExtensionSidebarWidth,
        props,
      }}
    >
      {children}
    </ExtensionSidebarContext.Provider>
  );
};

// The interactive learning plugin ID is transitioning from grafana-grafanadocsplugin-app to grafana-pathfinder-app.
// Support both until that migration is complete.
// Prioritize the new plugin ID (grafana-pathfinder-app).
export function getInteractiveLearningPluginId(availableComponents: ExtensionPointPluginMeta): string | undefined {
  if (availableComponents.has('grafana-pathfinder-app')) {
    return 'grafana-pathfinder-app';
  }

  if (availableComponents.has('grafana-grafanadocsplugin-app')) {
    return 'grafana-grafanadocsplugin-app';
  }

  return undefined;
}
