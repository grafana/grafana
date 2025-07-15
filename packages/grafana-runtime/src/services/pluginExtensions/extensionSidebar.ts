import { BusEventWithPayload } from '@grafana/data';

import { getAppEvents } from '../appEvents';

/**
 * @internal This is an internal API and should not be used outside of the Grafana Labs plugins.
 */
export interface OpenExtensionSidebarPayload {
  props?: Record<string, unknown>;
  pluginId: string;
  componentTitle: string;
}

/**
 * @internal This is an internal API and should not be used outside of the Grafana Labs plugins.
 */
export class OpenExtensionSidebarEvent extends BusEventWithPayload<OpenExtensionSidebarPayload> {
  static type = 'open-extension-sidebar';
}

/**
 * Open the extension sidebar for a given plugin and component.
 *
 * @internal This is an internal API and should not be used outside of the Grafana Labs plugins.
 * @param pluginId - The id of the plugin to open the sidebar for.
 * @param componentTitle - The title of the component to open the sidebar for.
 * @param props - The props to pass to the component.
 */
export function openExtensionSidebar(pluginId: string, componentTitle: string, props: Record<string, unknown>) {
  const event = new OpenExtensionSidebarEvent({
    pluginId,
    componentTitle,
    props,
  });
  getAppEvents().publish(event);
}
