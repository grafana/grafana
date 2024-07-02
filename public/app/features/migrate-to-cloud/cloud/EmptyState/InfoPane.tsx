import { Box } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { InfoItem } from '../../shared/InfoItem';
import { MigrationTokenPane } from '../MigrationTokenPane/MigrationTokenPane';

export const InfoPane = () => {
  return (
    <Box alignItems="flex-start" display="flex" padding={2} gap={2} direction="column" backgroundColor="secondary">
      <InfoItem
        title={t('migrate-to-cloud.migrate-to-this-stack.title', 'Let us help you migrate to this stack')}
        linkTitle={t('migrate-to-cloud.migrate-to-this-stack.link-title', 'View the full migration guide')}
        linkHref="https://grafana.com/docs/grafana-cloud/account-management/migration-guide"
      >
        <Trans i18nKey="migrate-to-cloud.migrate-to-this-stack.body">
          You can migrate some resources from your self-managed Grafana installation to this cloud stack. To do this
          securely, you&apos;ll need to generate a migration token. Your self-managed instance will use the token to
          authenticate with this cloud stack.
        </Trans>
        <MigrationTokenPane />
      </InfoItem>
    </Box>
  );
};
