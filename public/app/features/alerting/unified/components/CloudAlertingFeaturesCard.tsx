import { useState } from 'react';

import { GrafanaEdition } from '@grafana/data/internal';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, Box, Stack, TextLink } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { backendSrv } from 'app/core/services/backend_srv';

export interface Props {}

export function CloudAlertingFeaturesCard() {
  const isOpenSource = config.buildInfo.edition === GrafanaEdition.OpenSource;
  const helpFlags = contextSrv.user.helpFlags1;
  const HELP_FLAG_CLOUD_ALERTING = 0x0008;
  const [isDismissed, setDismissed] = useState<boolean>(Boolean(helpFlags & HELP_FLAG_CLOUD_ALERTING));

  const onDismiss = () => {
    backendSrv
      .put(`/api/user/helpflags/${HELP_FLAG_CLOUD_ALERTING}`, undefined, { showSuccessAlert: false })
      .then((res) => {
        contextSrv.user.helpFlags1 = res.helpFlags1;
        setDismissed(true);
      });
  };

  // This card is only visible in oss
  if (!isOpenSource || isDismissed) {
    return null;
  }

  return (
    <Box paddingTop={0}>
      <Alert
        severity="info"
        title={t('admin.enterprise-auth-features-card.title', 'Did you know?')}
        onRemove={onDismiss}
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <Trans i18nKey="admin.cloud-alerting-features-card.text">
            Grafana Cloud IRM combines on-call scheduling, alert routing, and incident response management.
            <TextLink
              href={`https://grafana.com/products/cloud/irm&utm_source=oss-grafana-alerting-contact-points`}
              external
              color="link"
            >
              Learn more about Grafana Cloud IRM.
            </TextLink>
          </Trans>
        </Stack>
      </Alert>
    </Box>
  );
}
