import { t } from '@grafana/i18n';
import { Menu } from '@grafana/ui';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';

import { notebookShareUrl } from '../urls';

import { DECLARE_INCIDENT_PATH, useNotebookIncidents } from './useNotebookIncidents';

interface Props {
  uid: string;
  title: string;
}

/**
 * Starts an incident from this notebook, by way of IRM's own declare form.
 *
 * A deep link rather than an API call: `url` is what IRM turns into attached context, so the new
 * incident comes out linked back here without this needing to write anything. Severity is left for
 * the form to ask about — a notebook says nothing about how bad the thing is.
 *
 * Deliberately not the shared DeclareIncidentMenuItem from alerting, which renders a disabled item
 * with an explanatory tooltip when IRM is missing. That suits an alert rule menu; here it would put
 * a permanently dead item in the menu of every stack without IRM.
 */
export function DeclareIncidentMenuItem({ uid, title }: Props) {
  const { pluginId, available } = useNotebookIncidents();

  if (!available) {
    return null;
  }

  return (
    <Menu.Item
      icon="fire"
      label={t('notebooks.incidents.declare', 'Declare incident')}
      url={createBridgeURL(pluginId, DECLARE_INCIDENT_PATH, { title, url: notebookShareUrl(uid) })}
      testId="notebook-declare-incident"
    />
  );
}
