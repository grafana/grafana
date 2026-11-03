import { useSyncExternalStore } from 'react';

import { appEvents } from 'app/core/app_events';
import { useExtensionSidebarContext } from 'app/core/components/AppChrome/ExtensionSidebar/ExtensionSidebarProvider';
import { getComponentIdFromComponentMeta } from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarUtils';
import { ASSISTANT_PLUGIN_ID } from 'app/core/constants';
import { OpenExtensionSidebarEvent } from 'app/types/events';

import {
  getSupportedComposerResources,
  requestComposerEnter,
  subscribeToComposerEnterRequests,
} from './composerEntryRequests';
import { type ComposerResource, type ComposerTarget } from './types';

/**
 * How Grafana's own UI (the dashboard mode picker, the notebook mode switch) asks Assistant to enter Composer
 * on a `resource`. Undefined while Assistant has registered no sidebar to show, or no listener of its enters
 * Composer on that document type; re-renders when that changes. The request opens the sidebar if needed and
 * hands Assistant the target; core never enters Composer itself.
 */
export function useAssistantComposerEntry(
  resource: ComposerResource
): { request: (target: ComposerTarget) => void } | undefined {
  const { availableComponents, dockedComponentId } = useExtensionSidebarContext();
  const supported = useSyncExternalStore(subscribeToComposerEnterRequests, getSupportedComposerResources);
  const componentTitle = availableComponents.get(ASSISTANT_PLUGIN_ID)?.addedComponents[0]?.title;
  if (!componentTitle || !supported.includes(resource)) {
    return undefined;
  }
  return {
    request: (target) => {
      if (dockedComponentId === getComponentIdFromComponentMeta(ASSISTANT_PLUGIN_ID, componentTitle)) {
        requestComposerEnter(target);
        return;
      }
      // The request floats the closed sidebar before it opens, so its first paint is never the docked column.
      if (requestComposerEnter(target, { float: true })) {
        appEvents.publish(new OpenExtensionSidebarEvent({ pluginId: ASSISTANT_PLUGIN_ID, componentTitle }));
      }
    },
  };
}
