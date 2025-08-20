import { createContext, ReactNode, useCallback, useContext, useEffect, useState, useMemo } from 'react';
import { useLocalStorage } from 'react-use';

import { PluginExtensionPoints, store, type ExtensionInfo } from '@grafana/data';
import { config, getAppEvents, reportInteraction, usePluginLinks, locationService } from '@grafana/runtime';
import { ExtensionPointPluginMeta, getExtensionPointPluginMeta } from 'app/features/plugins/extensions/utils';
import { CloseExtensionSidebarEvent, OpenExtensionSidebarEvent } from 'app/types/events';

import { DEFAULT_EXTENSION_SIDEBAR_WIDTH, MAX_EXTENSION_SIDEBAR_WIDTH } from './ExtensionSidebar';

export const EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY = 'grafana.navigation.extensionSidebarDocked';
export const EXTENSION_SIDEBAR_WIDTH_LOCAL_STORAGE_KEY = 'grafana.navigation.extensionSidebarWidth';
const PERMITTED_EXTENSION_SIDEBAR_PLUGINS = [
  'grafana-investigations-app',
  'grafana-assistant-app',
  'grafana-dash-app',
  'grafana-grafanadocsplugin-app',
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

export const ExtensionSidebarContext = createContext<ExtensionSidebarContextType>({
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
  const [extensionSidebarWidth, setExtensionSidebarWidth] = useLocalStorage(
    EXTENSION_SIDEBAR_WIDTH_LOCAL_STORAGE_KEY,
    DEFAULT_EXTENSION_SIDEBAR_WIDTH
  );

  const [currentPath, setCurrentPath] = useState(locationService.getLocation().pathname);

  useEffect(() => {
    const subscription = locationService.getLocationObservable().subscribe((location) => {
      setCurrentPath(location.pathname);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // these links are needed to conditionally render the extension component
  // that means, a plugin would need to register both, a link and a component to
  // `grafana/extension-sidebar/v0-alpha` and the link's `configure` method would control
  // whether the component is rendered or not
  const { links, isLoading } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.ExtensionSidebar,
    context: {
      path: currentPath,
    },
  });

  // get all components for this extension point, but only for the permitted plugins
  // if the extension sidebar is not enabled, we will return an empty map
  const availableComponents = useMemo(
    () =>
      new Map(
        Array.from(getExtensionPointPluginMeta(PluginExtensionPoints.ExtensionSidebar).entries()).filter(
          ([pluginId, pluginMeta]) =>
            PERMITTED_EXTENSION_SIDEBAR_PLUGINS.includes(pluginId) &&
            links.some(
              (link) =>
                link.pluginId === pluginId &&
                pluginMeta.addedComponents.some((component) => component.title === link.title)
            )
        )
      ),
    [links]
  );

  // check if the stored docked component is still available
  let defaultDockedComponentId: string | undefined;
  if (storedDockedPluginId) {
    const dockedMeta = getComponentMetaFromComponentId(storedDockedPluginId);
    if (dockedMeta) {
      defaultDockedComponentId = storedDockedPluginId;
    }
  }
  const [dockedComponentId, setDockedComponentId] = useState<string | undefined>(defaultDockedComponentId);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (dockedComponentId) {
      const dockedMeta = getComponentMetaFromComponentId(dockedComponentId);
      if (dockedMeta) {
        const plugin = availableComponents.get(dockedMeta.pluginId);
        if (!plugin || !plugin.addedComponents.some((c) => c.title === dockedMeta.componentTitle)) {
          setDockedComponentId(undefined);
        }
      } else {
        // no component found, so we clear the docked component id
        setDockedComponentId(undefined);
      }
    }
  }, [isLoading, availableComponents, dockedComponentId]);

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

    const openSubscription = getAppEvents().subscribe(OpenExtensionSidebarEvent, openSidebarHandler);
    const closeSubscription = getAppEvents().subscribe(CloseExtensionSidebarEvent, closeSidebarHandler);
    return () => {
      openSubscription.unsubscribe();
      closeSubscription.unsubscribe();
    };
  }, [setDockedComponentWithProps, availableComponents]);

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
          extensionSidebarWidth ?? DEFAULT_EXTENSION_SIDEBAR_WIDTH,
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

export function getComponentIdFromComponentMeta(pluginId: string, component: ExtensionInfo) {
  return JSON.stringify({ pluginId, componentTitle: component.title });
}

export function getComponentMetaFromComponentId(
  componentId: string
): { pluginId: string; componentTitle: string } | undefined {
  try {
    const parsed = JSON.parse(componentId);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'pluginId' in parsed &&
      'componentTitle' in parsed &&
      typeof parsed.pluginId === 'string' &&
      typeof parsed.componentTitle === 'string'
    ) {
      return parsed;
    }
    return undefined;
  } catch (error) {
    return undefined;
  }
}
