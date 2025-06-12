import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, LinkButton, Stack, TextLink } from '@grafana/ui';

export function EnterpriseAuthFeaturesCard() {
  return (
    <Alert severity="info" title="Did you know?" onRemove={() => {}}>
      <Stack direction="row" alignItems="center">
        You can sync users and teams with SCIM, authenticate using SAML and sync teams with LDAP. Learn more{' '}
        <TextLink href={`'asd`} external color="primary">
          Enterprise authentication.
        </TextLink>
      </Stack>
    </Alert>
  );
}
