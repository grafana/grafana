import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, LinkButton, Menu, useStyles2, useTheme2 } from '@grafana/ui';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { canAccessPluginPage, useIrmPlugin } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { buildDeclareIncidentParams, type DeclareIncidentNotebookContext } from './declareIncidentFromNotebook';

const DECLARE_INCIDENT_PATH = '/incidents/declare';

interface Props extends DeclareIncidentNotebookContext {
  /** Toolbar control (default) or hamburger menu item. */
  as?: 'button' | 'menu-item';
}

/**
 * IRM entry point from a notebook: opens declare-incident prefilled with a sensible
 * title, a labeled link back to the notebook, and a short description. Renders
 * nothing when IRM/Incident isn't available.
 */
export function DeclareIncidentFromNotebookButton({ as = 'button', ...ctx }: Props) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const { pluginId, loading, installed, settings } = useIrmPlugin(SupportedPlugin.Incident);

  if (loading || !installed || !settings) {
    return null;
  }

  if (!canAccessPluginPage(settings, createBridgeURL(pluginId, DECLARE_INCIDENT_PATH))) {
    return null;
  }

  const bridgeURL = createBridgeURL(pluginId, DECLARE_INCIDENT_PATH, buildDeclareIncidentParams(ctx));

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
