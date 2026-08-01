import { t } from '@grafana/i18n';
import { LinkButton } from '@grafana/ui';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { canAccessPluginPage, useIrmPlugin } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { notebookViewUrl } from '../api/notebookAPI';

const DECLARE_INCIDENT_PATH = '/incidents/declare';

interface Props {
  uid: string;
  title: string;
}

/**
 * IRM entry point from a notebook: escalates the captured investigation into a
 * declared incident, prefilled with the notebook title and a link back to the
 * notebook. Uses the same plugin bridge as alerting (IRM app with Incident app
 * fallback) and renders nothing when neither is available.
 */
export function DeclareIncidentFromNotebookButton({ uid, title }: Props) {
  const { pluginId, loading, installed, settings } = useIrmPlugin(SupportedPlugin.Incident);

  if (loading || !installed || !settings) {
    return null;
  }

  if (!canAccessPluginPage(settings, createBridgeURL(pluginId, DECLARE_INCIDENT_PATH))) {
    return null;
  }

  const notebookUrl = new URL(notebookViewUrl(uid), window.location.origin).toString();
  const bridgeURL = createBridgeURL(pluginId, DECLARE_INCIDENT_PATH, {
    title,
    url: notebookUrl,
  });

  const label = t('notebooks.declare-incident.button', 'Declare incident');

  // Icon-only keeps the editor toolbar compact; the label lives in the tooltip.
  return (
    <LinkButton
      variant="secondary"
      icon="fire"
      href={bridgeURL}
      tooltip={label}
      aria-label={label}
      data-testid="notebook-declare-incident"
    />
  );
}
