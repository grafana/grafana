import { type ExtensionSidebarAPI } from '@grafana/data';
import {
  canFloatExtensionSidebar,
  setExtensionSidebarPresentation,
} from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarLayout';

export const extensionSidebarApi: ExtensionSidebarAPI = {
  canFloat: () => canFloatExtensionSidebar(),
  setPresentation: (presentation) => {
    // Plugins call this from untyped code too; anything else is not a layout.
    if (presentation === 'docked' || presentation === 'floating') {
      setExtensionSidebarPresentation(presentation);
    }
  },
};
