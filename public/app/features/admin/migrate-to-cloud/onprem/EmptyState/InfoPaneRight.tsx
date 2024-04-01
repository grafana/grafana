import React from 'react';

import { Box } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { InfoItem } from '../../shared/InfoItem';

export const InfoPaneRight = () => {
  return (
    <Box alignItems="flex-start" display="flex" direction="column" gap={2} padding={2} backgroundColor="secondary">
      <InfoItem
        title={t('migrate-to-cloud.pdc.title', 'Not all my data sources are on the public internet')}
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
        title={t('migrate-to-cloud.can-i-move.title', 'Can I move this installation to Grafana Cloud?')}
        linkTitle={t('migrate-to-cloud.can-i-move.link-title', 'Learn about migrating other settings')}
        linkHref="https://grafana.com/docs/grafana-cloud/account-management/migration-guide"
      >
        <Trans i18nKey="migrate-to-cloud.can-i-move.body">
          Once you connect this installation to a cloud stack, you&apos;ll be able to upload data sources and
          dashboards.
        </Trans>
      </InfoItem>
    </Box>
  );
};
