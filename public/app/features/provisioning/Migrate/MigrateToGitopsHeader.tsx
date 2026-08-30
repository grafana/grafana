import { FeatureState } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { FeatureBadge, Stack, Text } from '@grafana/ui';

/** Title, experimental badge and intro copy shown at the top of the Migrate tab. */
export function MigrateToGitopsHeader() {
  return (
    <Stack direction="column" gap={1}>
      <Stack direction="row" gap={1} alignItems="center">
        <Text element="h2" variant="h2">
          <Trans i18nKey="provisioning.migrate.header-title">Migrate to GitOps</Trans>
        </Text>
        <FeatureBadge featureState={FeatureState.experimental} />
      </Stack>
      <Text color="secondary">
        <Trans i18nKey="provisioning.migrate.header-subtitle">
          Manage your Grafana resources like code — every change tracked, every update reviewed, every environment
          reproducible. Connect a Git repository to get started.
        </Trans>
      </Text>
    </Stack>
  );
}
