import { css } from '@emotion/css';

import { type GrafanaTheme2, textUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Box, TextLink, useStyles2 } from '@grafana/ui';

interface InstanceDeclareIncidentFormProps {
  incidentURL: string;
}

export function InstanceDeclareIncidentForm({ incidentURL }: InstanceDeclareIncidentFormProps) {
  const styles = useStyles2(getStyles);
  const safeIncidentURL = textUtil.sanitizeUrl(incidentURL);
  const iframeTitle = t('alerting.triage.instance-details-drawer.declare-incident-frame-title', 'Declare incident');

  return (
    <Box className={styles.container}>
      <iframe title={iframeTitle} src={safeIncidentURL} className={styles.iframe} />
      <TextLink href={safeIncidentURL} external>
        <Trans i18nKey="alerting.triage.instance-details-drawer.open-incident-new-tab">
          Open incident form in new tab
        </Trans>
      </TextLink>
    </Box>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    height: '100%',
    minHeight: 0,
  }),
  iframe: css({
    flexGrow: 1,
    minHeight: 420,
    width: '100%',
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.primary,
  }),
});
