import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Badge, Card, ClipboardButton, Stack, Text, useStyles2 } from '@grafana/ui';

const ENABLE_ALERTING_SNIPPET = `[unified_alerting]
enabled = true
`;

const DISABLE_ALERTING_SNIPPET = `[unified_alerting]
enabled = false
`;

const ENABLE_UI_SNIPPET = `[unified_alerting]
ui_enabled = true
`;

const DISABLE_UI_SNIPPET = `[unified_alerting]
ui_enabled = false
`;

export function AlertingSettingsCard() {
  const styles = useStyles2(getStyles);
  const isEnabled = config.unifiedAlertingEnabled;
  const isUIEnabled = config.unifiedAlertingUIEnabled !== false;
  const statusText = isEnabled
    ? t('admin.alerting.status.enabled', 'Enabled')
    : t('admin.alerting.status.disabled', 'Disabled');
  const actionText = isEnabled
    ? t('admin.alerting.action.disable', 'disable alerting')
    : t('admin.alerting.action.enable', 'enable alerting');
  const snippet = isEnabled ? DISABLE_ALERTING_SNIPPET : ENABLE_ALERTING_SNIPPET;
  const uiStatusText = isUIEnabled
    ? t('admin.alerting.ui-status.visible', 'Visible')
    : t('admin.alerting.ui-status.hidden', 'Hidden');
  const uiActionText = isUIEnabled
    ? t('admin.alerting.ui-action.hide', 'hide alerting UI')
    : t('admin.alerting.ui-action.show', 'show alerting UI');
  const uiSnippet = isUIEnabled ? DISABLE_UI_SNIPPET : ENABLE_UI_SNIPPET;

  return (
    <Card noMargin className={styles.card}>
      <Stack direction="column" gap={1.5}>
        <Text variant="h5">{t('admin.alerting.title', 'Grafana Alerting')}</Text>
        <Stack justifyContent="space-between" alignItems="center">
          <Text weight="medium">{t('admin.alerting.backend-title', 'Alerting backend')}</Text>
          <Badge color={isEnabled ? 'green' : 'orange'} text={statusText} />
        </Stack>
        <Text>
          {t(
            'admin.alerting.backend-description',
            'Controls rule evaluation and notifications for this instance.'
          )}
        </Text>
        <Text>
          {t(
            'admin.alerting.instructions',
            'To {actionText}, update grafana.ini (or environment variables) and restart Grafana:',
            { actionText }
          )}
        </Text>
        <Stack direction="row" gap={1} alignItems="center" wrap="wrap">
          <pre className={styles.code}>{snippet}</pre>
          <ClipboardButton icon="copy" variant="primary" size="sm" getText={() => snippet}>
            {t('admin.alerting.copy', 'Copy config snippet')}
          </ClipboardButton>
        </Stack>
        <Stack justifyContent="space-between" alignItems="center">
          <Text weight="medium">{t('admin.alerting.ui-title', 'Alerting UI')}</Text>
          <Badge color={isUIEnabled ? 'green' : 'orange'} text={uiStatusText} />
        </Stack>
        <Text>
          {t(
            'admin.alerting.ui-description',
            'Controls visibility for alerting pages, tabs, and menu actions.'
          )}
        </Text>
        <Text>
          {t(
            'admin.alerting.ui-instructions',
            'To {uiActionText}, update grafana.ini (or environment variables) and restart Grafana:',
            { uiActionText }
          )}
        </Text>
        <Stack direction="row" gap={1} alignItems="center" wrap="wrap">
          <pre className={styles.code}>{uiSnippet}</pre>
          <ClipboardButton icon="copy" variant="primary" size="sm" getText={() => uiSnippet}>
            {t('admin.alerting.copy-ui', 'Copy UI config snippet')}
          </ClipboardButton>
        </Stack>
        <Text color="secondary" variant="bodySmall">
          {t('admin.alerting.restart-note', 'Restart Grafana after changing the configuration.')}
        </Text>
      </Stack>
    </Card>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(2),
  }),
  code: css({
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.size.sm,
    margin: 0,
    padding: theme.spacing(1),
    whiteSpace: 'pre',
  }),
});
