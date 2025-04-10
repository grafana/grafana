import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Box, Stack, TextLink, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { InfoItem } from '../../shared/InfoItem';

export const MigrationStepsPane = () => {
  const styles = useStyles2(getStyles);

  return (
    <Box alignItems="flex-start" display="flex" direction="column" gap={2}>
      <InfoItem
        title={t('migrate-to-cloud.get-started.title', 'Performing a migration')}
        linkTitle={t('migrate-to-cloud.get-started.link-title', 'Learn more about Private Data Source Connect')}
        linkHref="https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect"
      >
        <Stack direction="column" gap={2}>
          <Trans i18nKey="migrate-to-cloud.get-started.body">
            The migration process must be started from your self-managed Grafana instance.
          </Trans>
          <ol className={styles.list}>
            <li>
              <Trans i18nKey="migrate-to-cloud.get-started.step-1">
                Log in to your self-managed instance and navigate to Administration &gt; General &gt; Migrate to Grafana
                Cloud.
              </Trans>
            </li>
            <li>
              <Trans i18nKey="migrate-to-cloud.get-started.step-2">
                Select &quot;Migrate this instance to Cloud&quot;.
              </Trans>
            </li>
            <li>
              <Trans i18nKey="migrate-to-cloud.get-started.step-3">
                You&apos;ll be prompted for a migration token. Generate one from this screen. Enter your token and click
                &quot;Connect to this stack&quot;.
              </Trans>
            </li>
            <li>
              <Trans i18nKey="migrate-to-cloud.get-started.step-4">
                After connecting to the cloud stack, click &quot;Build snapshot&quot; to create a snapshot of your
                self-managed instance.
              </Trans>
            </li>
            <li>
              <Trans i18nKey="migrate-to-cloud.get-started.step-5">
                After a snapshot is created, click &quot;Upload snapshot&quot; to copy the resources to your cloud
                stack.
              </Trans>
            </li>
            <li>
              <Trans i18nKey="migrate-to-cloud.get-started.step-6">
                If some of your data sources will not work over the public internet, you’ll need to install Private Data
                Source Connect in your self-managed environment.
              </Trans>
            </li>
          </ol>
        </Stack>
      </InfoItem>
      <TextLink href="/connections/private-data-source-connections" external>
        {t('migrate-to-cloud.get-started.configure-pdc-link', 'Configure PDC for this stack')}
      </TextLink>
      <TextLink href="https://grafana.com/docs/grafana-cloud/account-management/migration-guide" external>
        {t('migrate-to-cloud.migrate-to-this-stack.link-title', 'View the full migration guide')}
      </TextLink>
    </Box>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  list: css({
    padding: 'revert',
  }),
});
