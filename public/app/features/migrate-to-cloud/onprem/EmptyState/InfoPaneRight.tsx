import { Trans, t } from '@grafana/i18n';
import { Stack } from '@grafana/ui';

import { InfoItem } from '../../shared/InfoItem';

export const InfoPaneRight = () => {
  return (
    <Stack gap={4} direction="column">
      <InfoItem
        title={t('migrate-to-cloud.pdc.title', 'What if not all my data sources are on the public internet?')}
        linkTitle={t('migrate-to-cloud.pdc.link-title', 'Learn about PDC')}
        linkHref="https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect"
      >
        <Trans i18nKey="migrate-to-cloud.pdc.body">
          Exposing your data sources to the internet can raise security concerns. Private data source connect (PDC)
          allows Grafana Cloud to access your existing data sources over a secure network tunnel.
        </Trans>
      </InfoItem>
      <InfoItem
        title={t('migrate-to-cloud.pricing.title', 'How much does it cost?')}
        linkTitle={t('migrate-to-cloud.pricing.link-title', 'Grafana Cloud pricing')}
        linkHref="https://grafana.com/pricing"
      >
        <Trans i18nKey="migrate-to-cloud.pricing.body">
          Grafana Cloud has a generous free plan and a 14 day unlimited usage trial. After your trial expires,
          you&apos;ll be billed based on usage over the free plan limits.
        </Trans>
      </InfoItem>
      <InfoItem
        title={t('migrate-to-cloud.can-i-move.title', 'Where can I learn more about migrating to Grafana Cloud?')}
        linkTitle={t('migrate-to-cloud.can-i-move.link-title', 'Learn about migrating to Grafana Cloud')}
        linkHref="https://grafana.com/docs/grafana-cloud/account-management/migration-guide"
      >
        <Trans i18nKey="migrate-to-cloud.can-i-move.body">
          You can use the migration assistant to migrate a large proportion of your Grafana resources.
        </Trans>
      </InfoItem>
    </Stack>
  );
};
