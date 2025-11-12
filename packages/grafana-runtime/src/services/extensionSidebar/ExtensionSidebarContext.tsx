import { createContext, useContext } from 'react';

import { ExtensionInfo } from '@grafana/data';

export const DEFAULT_EXTENSION_SIDEBAR_WIDTH = 500;

export type ExtensionPointPluginMeta = Map<
  string,
  {
    readonly addedComponents: ExtensionInfo[];
    readonly addedLinks: ExtensionInfo[];
  }
>;

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
   * Set the id of the component that will be rendered in the extension sidebar.
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

/**
 * Hook to access the extension sidebar context.
 * This context provides information about the current state of the extension sidebar,
 * including whether it's open, what component is docked, and methods to control it.
 *
 * @public
 */
export function useExtensionSidebarContext() {
  return useContext(ExtensionSidebarContext);
}
