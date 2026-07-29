import { Trans, t } from '@grafana/i18n';
import { Alert, Spinner, Stack, Text } from '@grafana/ui';

export function AuthorizationPendingAlert() {
  const title = t('provisioning.oauth-authorization.pending-title', 'Waiting for authorization in the other tab');

  // Alert only accepts a string title, so the spinner and title render in the
  // body with matching typography; the title prop stays empty for layout and
  // is passed as the aria-label instead.
  return (
    <Alert severity="warning" title="" aria-label={title}>
      <Stack alignItems="center" gap={1}>
        <Text color="primary" weight="medium">
          {title}
        </Text>
        <Spinner size="sm" inline />
      </Stack>
      <Trans i18nKey="provisioning.oauth-authorization.pending-body">
        If the provider shows an error page, verify the client ID and attempt to reauthorize.
      </Trans>
    </Alert>
  );
}
