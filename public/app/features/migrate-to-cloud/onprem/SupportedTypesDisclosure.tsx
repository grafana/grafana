import { Text, TextLink } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

export function SupportedTypesDisclosure() {
  return (
    <Text color="secondary" textAlignment="center">
      <Trans i18nKey="migrate-to-cloud.support-types-disclosure.text">
        Dashboards, Folders, and built-in core data sources are migrated to your Grafana Cloud stack.{' '}
        <TextLink external href="https://grafana.com/docs/grafana-cloud/account-management/migration-guide">
          Learn about migrating other settings.
        </TextLink>
      </Trans>
    </Text>
  );
}
