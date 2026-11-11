import * as React from 'react';

import { Trans, t } from '@grafana/i18n';
import { Alert, TextLink } from '@grafana/ui';

import { type CatalogPlugin } from '../types';

type Props = {
  className?: string;
  plugin: CatalogPlugin;
};

const CANVAS_PLUGIN_ID = 'canvas';
const CANVAS_PLUGIN_UPDATES_DOCS_URL =
  'https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/visualizations/canvas/#plugin-updates';

// The external canvas plugin shares the core plugin's ID, so only the core build gets the notice.
export function PluginDetailsCanvasExternalizationNotice({ className, plugin }: Props): React.ReactElement | null {
  if (plugin.id !== CANVAS_PLUGIN_ID || !plugin.isCore) {
    return null;
  }

  return (
    <Alert
      severity="info"
      title={t('plugins.plugin-details-canvas-externalization-notice.title', 'Canvas is moving out of core')}
      className={className}
    >
      <Trans i18nKey="plugins.plugin-details-canvas-externalization-notice.body">
        Starting with Grafana 13.3, the canvas visualization loads as a standalone plugin by default. This instance uses
        the core plugin because <code>as_external = false</code> is set in the <code>[plugin.canvas]</code> section of
        the configuration file. Grafana 14.0 removes the core plugin. To switch now, remove the setting and restart
        Grafana. Existing dashboards keep working.{' '}
        <TextLink href={CANVAS_PLUGIN_UPDATES_DOCS_URL} external>
          Learn more
        </TextLink>
      </Trans>
    </Alert>
  );
}
