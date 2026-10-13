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
        Starting with Grafana 14.0, the canvas visualization will no longer be a core plugin. It will ship as a
        standalone plugin that updates separately from Grafana. Existing dashboards will keep working.{' '}
        <TextLink href={CANVAS_PLUGIN_UPDATES_DOCS_URL} external>
          Learn more
        </TextLink>
      </Trans>
    </Alert>
  );
}
