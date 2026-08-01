import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, LinkButton, Menu, useStyles2, useTheme2 } from '@grafana/ui';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { canAccessPluginPage, useIrmPlugin } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { notebookViewUrl } from '../api/notebookAPI';

const DECLARE_INCIDENT_PATH = '/incidents/declare';

interface Props {
  uid: string;
  title: string;
  /** Toolbar control (default) or hamburger menu item. */
  as?: 'button' | 'menu-item';
}

/**
 * IRM entry point from a notebook: escalates the captured investigation into a
 * declared incident, prefilled with the notebook title and a link back to the
 * notebook. Uses the same plugin bridge as alerting (IRM app with Incident app
 * fallback) and renders nothing when neither is available.
 */
export function DeclareIncidentFromNotebookButton({ uid, title, as = 'button' }: Props) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
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
  const fireColor = theme.colors.error.text;

  if (as === 'menu-item') {
    return (
      <Menu.Item icon="fire" iconColor={fireColor} label={label} url={bridgeURL} testId="notebook-declare-incident" />
    );
  }

  // Match Edit / time-picker chrome: secondary filled control with a colored fire glyph.
  return (
    <LinkButton
      variant="secondary"
      href={bridgeURL}
      tooltip={label}
      aria-label={label}
      data-testid="notebook-declare-incident"
    >
      <Icon name="fire" className={styles.fireIcon} />
    </LinkButton>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  fireIcon: css({
    color: theme.colors.error.text,
  }),
});
