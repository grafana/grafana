import { createContext, ReactNode, useCallback, useContext, useEffect, useState, useMemo } from 'react';
import { useLocalStorage } from 'react-use';

import { PluginExtensionPoints, store } from '@grafana/data';
import { getAppEvents, reportInteraction, usePluginLinks, locationService } from '@grafana/runtime';
import { ExtensionPointPluginMeta, getExtensionPointPluginMeta } from 'app/features/plugins/extensions/utils';
import { CloseBottomDrawerEvent, OpenBottomDrawerEvent, ToggleBottomDrawerEvent } from 'app/types/events';

import { DEFAULT_BOTTOM_DRAWER_HEIGHT, MAX_BOTTOM_DRAWER_HEIGHT } from './BottomDrawer';

export const BOTTOM_DRAWER_DOCKED_LOCAL_STORAGE_KEY = 'grafana.navigation.bottomDrawerDocked';
export const BOTTOM_DRAWER_HEIGHT_LOCAL_STORAGE_KEY = 'grafana.navigation.bottomDrawerHeight';

// List of permitted plugins that can use the bottom drawer
const PERMITTED_BOTTOM_DRAWER_PLUGINS: string[] = ['grafana-grafanacoda-app'];

export type BottomDrawerContextType = {
  /**
   * Whether the bottom drawer is open.
   */
  isOpen: boolean;
  /**
   * The id of the component that is currently docked in the drawer. If the id is undefined, nothing will be rendered.
   */
  dockedComponentId: string | undefined;
  /**
   * Sets the id of the component that will be rendered in the bottom drawer.
   */
  setDockedComponentId: (componentId: string | undefined) => void;
  /**
   * A map of all components that are available for the extension point.
   */
  availableComponents: ExtensionPointPluginMeta;
  /**
   * The height of the bottom drawer.
   */
  bottomDrawerHeight: number;
  /**
   * Set the height of the bottom drawer.
   */
  setBottomDrawerHeight: (height: number) => void;

  props?: Record<string, unknown>;
};

export const BottomDrawerContext = createContext<BottomDrawerContextType>({
  isOpen: false,
  dockedComponentId: undefined,
  setDockedComponentId: () => {},
  availableComponents: new Map(),
  bottomDrawerHeight: DEFAULT_BOTTOM_DRAWER_HEIGHT,
  setBottomDrawerHeight: () => {},
});

export function useBottomDrawerContext() {
  return useContext(BottomDrawerContext);
}

interface BottomDrawerContextProps {
  children: ReactNode;
}

export const BottomDrawerContextProvider = ({ children }: BottomDrawerContextProps) => {
  const [props, setProps] = useState<Record<string, unknown> | undefined>(undefined);
  const storedDockedPluginId = store.get(BOTTOM_DRAWER_DOCKED_LOCAL_STORAGE_KEY);
  const [bottomDrawerHeight, setBottomDrawerHeight] = useLocalStorage(
    BOTTOM_DRAWER_HEIGHT_LOCAL_STORAGE_KEY,
    DEFAULT_BOTTOM_DRAWER_HEIGHT
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
  // `grafana/bottom-drawer/v0-alpha` and the link's `configure` method would control
  // whether the component is rendered or not
  const { links, isLoading } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.BottomDrawer,
    context: {
      path: currentPath,
    },
  });

  // get all components for this extension point, but only for the permitted plugins
  const availableComponents = useMemo(
    () =>
      new Map(
        Array.from(getExtensionPointPluginMeta(PluginExtensionPoints.BottomDrawer).entries()).filter(
          ([pluginId, pluginMeta]) =>
            PERMITTED_BOTTOM_DRAWER_PLUGINS.includes(pluginId) &&
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
    // handler to open the bottom drawer from plugins. this is done with the `helpers.openBottomDrawer` function
    const openDrawerHandler = (event: OpenBottomDrawerEvent) => {
      if (
        event.payload.pluginId &&
        event.payload.componentTitle &&
        PERMITTED_BOTTOM_DRAWER_PLUGINS.includes(event.payload.pluginId) &&
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

    const closeDrawerHandler = () => {
      setDockedComponentId(undefined);
    };

    const toggleDrawerHandler = (event: ToggleBottomDrawerEvent) => {
      const currentComponentMeta = getComponentMetaFromComponentId(dockedComponentId ?? '');
      const isCurrentlyOpen =
        currentComponentMeta?.pluginId === event.payload.pluginId &&
        currentComponentMeta?.componentTitle === event.payload.componentTitle;

      if (isCurrentlyOpen) {
        closeDrawerHandler();
      } else {
        openDrawerHandler(event);
      }
    };

    const openSubscription = getAppEvents().subscribe(OpenBottomDrawerEvent, openDrawerHandler);
    const closeSubscription = getAppEvents().subscribe(CloseBottomDrawerEvent, closeDrawerHandler);
    const toggleSubscription = getAppEvents().subscribe(ToggleBottomDrawerEvent, toggleDrawerHandler);
    return () => {
      openSubscription.unsubscribe();
      closeSubscription.unsubscribe();
      toggleSubscription.unsubscribe();
    };
  }, [setDockedComponentWithProps, availableComponents, dockedComponentId]);

  // update the stored docked component id when it changes
  useEffect(() => {
    // wait for the plugin links to be loaded before we update the stored docked component id
    if (isLoading) {
      return;
    }
    const componentMeta = getComponentMetaFromComponentId(dockedComponentId ?? '');
    const storedComponentId = store.get(BOTTOM_DRAWER_DOCKED_LOCAL_STORAGE_KEY);
    const storedComponentMeta = getComponentMetaFromComponentId(storedComponentId ?? '');
    const opened = dockedComponentId !== undefined;
    // we either want to track opened events, or closed events when we have a previous component
    if (opened || storedComponentMeta) {
      reportInteraction('grafana_bottom_drawer_changed', {
        opened: opened,
        componentTitle: (opened ? componentMeta : storedComponentMeta)?.componentTitle,
        pluginId: (opened ? componentMeta : storedComponentMeta)?.pluginId,
        fromLocalstorage: storedComponentId === dockedComponentId,
      });
    }
    if (dockedComponentId) {
      store.set(BOTTOM_DRAWER_DOCKED_LOCAL_STORAGE_KEY, dockedComponentId);
    } else {
      store.delete(BOTTOM_DRAWER_DOCKED_LOCAL_STORAGE_KEY);
    }
  }, [dockedComponentId, isLoading]);

  return (
    <BottomDrawerContext.Provider
      value={{
        isOpen: dockedComponentId !== undefined,
        dockedComponentId,
        setDockedComponentId: (componentId) => setDockedComponentWithProps(componentId, undefined),
        availableComponents,
        bottomDrawerHeight: Math.min(bottomDrawerHeight ?? DEFAULT_BOTTOM_DRAWER_HEIGHT, MAX_BOTTOM_DRAWER_HEIGHT),
        setBottomDrawerHeight,
        props,
      }}
    >
      {children}
    </BottomDrawerContext.Provider>
  );
};

export function getComponentIdFromComponentMeta(pluginId: string, componentTitle: string) {
  return JSON.stringify({ pluginId, componentTitle });
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
