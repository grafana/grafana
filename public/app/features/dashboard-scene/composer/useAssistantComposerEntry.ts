import { appEvents } from 'app/core/app_events';
import { useExtensionSidebarContext } from 'app/core/components/AppChrome/ExtensionSidebar/ExtensionSidebarProvider';
import { getComponentIdFromComponentMeta } from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarUtils';
import { OpenExtensionSidebarEvent } from 'app/types/events';

import { requestComposerEnter } from './composerEntryRequests';
import { type ComposerTarget } from './types';

export const ASSISTANT_PLUGIN_ID = 'grafana-assistant-app';

/**
 * How Grafana's own UI (the dashboard mode picker, the notebook toolbar) asks Assistant to enter Composer.
 * Undefined while Assistant has registered no sidebar to show. The request opens that sidebar if needed and
 * hands Assistant the target; core never enters Composer itself.
 */
export function useAssistantComposerEntry(): { request: (target: ComposerTarget) => void } | undefined {
  const { availableComponents, dockedComponentId } = useExtensionSidebarContext();
  const componentTitle = availableComponents.get(ASSISTANT_PLUGIN_ID)?.addedComponents[0]?.title;
  if (!componentTitle) {
    return undefined;
  }
  return {
    request: (target) => {
      if (dockedComponentId === getComponentIdFromComponentMeta(ASSISTANT_PLUGIN_ID, componentTitle)) {
        requestComposerEnter(target);
        return;
      }
      // The request floats the closed sidebar before it opens, so its first paint is never the docked column.
      requestComposerEnter(target, { float: true });
      appEvents.publish(new OpenExtensionSidebarEvent({ pluginId: ASSISTANT_PLUGIN_ID, componentTitle }));
    },
  };
}
