import { useState } from 'react';

import { GrafanaEdition } from '@grafana/data/internal';
import { t, Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, Box, Stack, TextLink } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { backendSrv } from 'app/core/services/backend_srv';

export function EnterpriseAuthFeaturesCard() {
  const isOpenSource = config.buildInfo.edition === GrafanaEdition.OpenSource;
  const helpFlags = contextSrv.user.helpFlags1;
  const [isDismissed, setDismissed] = useState<boolean>(Boolean(helpFlags & 0x0004)); // 0x0004 is the flag for the Enterprise Auth Features Card

  const onDismiss = () => {
    backendSrv.put('/api/user/helpflags/4', undefined, { showSuccessAlert: false }).then((res) => {
      contextSrv.user.helpFlags1 = res.helpFlags1;
      setDismissed(true);
    });
  };

  // This card is only visible in oss
  if (!isOpenSource || isDismissed) {
    return null;
  }

  return (
    <Box paddingTop={4}>
      <Alert
        severity="info"
        title={t('admin.enterprise-auth-features-card.title', 'Did you know')}
        onRemove={onDismiss}
      >
        <Stack direction="row" alignItems="center">
          <Trans i18nKey="admin.enterprise-auth-features-card.text">
            Sync users and teams using SCIM, sync teams from LDAP, or authenticate using SAML in Grafana Cloud and
            Enterprise. Learn more about{' '}
            <TextLink href={`'asd`} external color="primary">
              Enterprise authentication.
            </TextLink>
          </Trans>
        </Stack>
      </Alert>
    </Box>
  );
}
