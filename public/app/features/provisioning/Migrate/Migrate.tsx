import { css } from '@emotion/css';

import { FeatureState, type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { FeatureBadge, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';

import { CONFIGURE_GRAFANA_DOCS_URL } from '../constants';

/**
 * Migrate to GitOps tab. This is the entry point for moving existing folders
 * and dashboards into a Git repository. The interactive migration workflow
 * (folder leaderboard, quick wins, the migrate drawer) lands in follow-up
 * changes — for now the tab introduces the feature and links to the guide.
 */
export function Migrate() {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="column" gap={2}>
      <Stack direction="column" gap={1}>
        <Stack direction="row" gap={1} alignItems="center">
          <Text element="h2" variant="h2">
            <Trans i18nKey="provisioning.migrate.header-title">Migrate to GitOps</Trans>
          </Text>
          <FeatureBadge featureState={FeatureState.experimental} />
        </Stack>
        <Text color="secondary">
          <Trans i18nKey="provisioning.migrate.header-subtitle">
            Manage your dashboards and folders like code — every change tracked, every update reviewed, every
            environment reproducible. Connect a Git repository to get started.
          </Trans>
        </Text>
      </Stack>

      <div className={styles.intro}>
        <Text color="secondary">
          <Trans i18nKey="provisioning.migrate.intro">
            The guided migration workflow is on its way. In the meantime, read the{' '}
            <TextLink external href={CONFIGURE_GRAFANA_DOCS_URL}>
              provisioning documentation
            </TextLink>{' '}
            to learn how Git Sync keeps Grafana and your repository in step.
          </Trans>
        </Text>
      </div>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  intro: css({
    padding: theme.spacing(2),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.secondary,
  }),
});
