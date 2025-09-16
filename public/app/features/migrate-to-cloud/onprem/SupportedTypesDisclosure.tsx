import { Trans } from '@grafana/i18n';
import { Text, TextLink } from '@grafana/ui';

export function SupportedTypesDisclosure() {
  return (
    <Text color="secondary" textAlignment="center">
      <Trans i18nKey="migrate-to-cloud.support-types-disclosure.text">
        Resources are copied to your Grafana Cloud stack.{' '}
        <TextLink
          external
          href="https://grafana.com/docs/grafana-cloud/security-and-account-management/migration-guide/"
        >
          Learn more
        </TextLink>{' '}
        about the full set of supported resources and migrating other settings.
      </Trans>
    </Text>
  );
}
