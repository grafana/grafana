import { t } from '@grafana/i18n';
import { registerPlaylistItemKind } from '@grafana/runtime';
import { FlagKeys, getAppPluginMeta, getFeatureFlagClient } from '@grafana/runtime/internal';

import { notebookViewUrl } from '../../notebook/urls';

import { createAppPlatformResolver } from './appPlatformResolver';
import { dashboardKind } from './dashboardKind';

const ASSISTANT_APP_ID = 'grafana-assistant-app';

/**
 * Registers the object kinds that slideshows can contain out of the box. Pages and notebooks are
 * only offered where their owning feature is present, so the editor never lists a kind that
 * cannot be played.
 */
export async function registerSlideshowKinds() {
  registerPlaylistItemKind(dashboardKind);

  // Core stand-in for the assistant app, which owns this kind and has not registered it itself.
  if (await getAppPluginMeta(ASSISTANT_APP_ID)) {
    registerPlaylistItemKind(
      createAppPlatformResolver({
        group: 'assistant.ext.grafana.app',
        version: 'v0alpha1',
        resource: 'pages',
        title: t('slideshows.kinds.pages', 'Pages'),
        icon: 'file-alt',
        viewUrl: (name) => `/a/${ASSISTANT_APP_ID}/pages/${encodeURIComponent(name)}`,
      })
    );
  }

  if (getFeatureFlagClient().getBooleanValue(FlagKeys.DashboardNotebooks, false)) {
    registerPlaylistItemKind(
      createAppPlatformResolver({
        group: 'dashboard.grafana.app',
        version: 'v2beta1',
        resource: 'notebooks',
        title: t('slideshows.kinds.notebooks', 'Notebooks'),
        icon: 'book',
        viewUrl: notebookViewUrl,
      })
    );
  }
}
