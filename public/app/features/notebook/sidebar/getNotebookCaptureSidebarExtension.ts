/* eslint-disable @grafana/i18n/no-untranslated-strings -- extension metadata is registered before i18n is ready */
import { type PluginExtensionAddedLinkConfig, PluginExtensionPoints } from '@grafana/data';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { createAddedLinkConfig } from 'app/features/plugins/extensions/utils';

import { canEditNotebooks } from '../permissions';
import { NOTEBOOKS_BASE_URL } from '../urls';

export const NOTEBOOK_CAPTURE_SIDEBAR_TITLE = 'Notebook';

interface ExtensionSidebarContext {
  path: string;
}

export function getNotebookCaptureSidebarExtension(): PluginExtensionAddedLinkConfig {
  return createAddedLinkConfig<ExtensionSidebarContext>({
    title: NOTEBOOK_CAPTURE_SIDEBAR_TITLE,
    description: 'Capture notes in a notebook without leaving your current view',
    targets: [PluginExtensionPoints.ExtensionSidebar],
    icon: 'book',
    configure: (context) => {
      const path = context?.path;
      if (!path) {
        return undefined;
      }

      const enabled = getFeatureFlagClient().getBooleanValue(FlagKeys.DashboardNotebooks, false);
      const isNotebookRoute = path === NOTEBOOKS_BASE_URL || path.startsWith(`${NOTEBOOKS_BASE_URL}/`);

      return enabled && canEditNotebooks() && !isNotebookRoute ? {} : undefined;
    },
    onClick: (_, { openSidebar }) => openSidebar(NOTEBOOK_CAPTURE_SIDEBAR_TITLE),
  });
}
