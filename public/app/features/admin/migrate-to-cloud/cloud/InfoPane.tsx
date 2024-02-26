import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Box, Stack, TextLink, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { InfoItem } from '../shared/InfoItem';

export const InfoPane = () => {
  const styles = useStyles2(getStyles);

  return (
    <Box alignItems="flex-start" display="flex" padding={2} gap={2} direction="column" backgroundColor="secondary">
      <InfoItem
        title={t('migrate-to-cloud.migrate-to-this-stack.title', 'Migrate configuration to this stack')}
        linkTitle={t('migrate-to-cloud.migrate-to-this-stack.link-title', 'View the full migration guide')}
        linkHref="https://grafana.com/docs/grafana-cloud/account-management/migration-guide"
      >
        <Trans i18nKey="migrate-to-cloud.migrate-to-this-stack.body">
          Some configuration from your self-managed Grafana instance can be automatically copied to this cloud stack.
        </Trans>
      </InfoItem>
      <InfoItem
        title={t('migrate-to-cloud.get-started.title', 'How to get started')}
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
                Log in to your self-managed instance and navigate to Administration, General, Migrate to Grafana Cloud.
              </Trans>
            </li>
            <li>
              <Trans i18nKey="migrate-to-cloud.get-started.step-2">
                Select &quot;Migrate this instance to Cloud&quot;.
              </Trans>
            </li>
            <li>
              <Trans i18nKey="migrate-to-cloud.get-started.step-3">
                You&apos;ll be prompted for a migration token. Generate one from this screen.
              </Trans>
            </li>
            <li>
              <Trans i18nKey="migrate-to-cloud.get-started.step-4">
                In your self-managed instance, select &quot;Upload everything&quot; to upload data sources and
                dashboards to this cloud stack.
              </Trans>
            </li>
            <li>
              <Trans i18nKey="migrate-to-cloud.get-started.step-5">
                If some of your data sources will not work over the public internet, you’ll need to install Private Data
                Source Connect in your self-managed environment.
              </Trans>
            </li>
          </ol>
        </Stack>
      </InfoItem>
      <TextLink href="/TODO">
        {t('migrate-to-cloud.get-started.configure-pdc-link', 'Configure PDC for this stack')}
      </TextLink>
    </Box>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  list: css({
    padding: 'revert',
  }),
});
