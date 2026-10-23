import { t, Trans } from '@grafana/i18n';
import { Box, Grid, Stack } from '@grafana/ui';

import { InfoItem } from '../../shared/InfoItem';

import { CallToAction } from './CallToAction/CallToAction';

export const EmptyState = () => {
  return (
    <Box display="flex" alignItems="center" direction="column">
      <Box maxWidth={180}>
        <Stack gap={5} direction="column">
          <CallToAction />

          <Grid
            alignItems="flex-start"
            gap={4}
            columns={{
              xs: 1,
              lg: 2,
            }}
          >
            <InfoItem
              title={t('migrate-to-cloud.what-is-cloud.title', 'What is Grafana Cloud?')}
              linkTitle={t('migrate-to-cloud.what-is-cloud.link-title', 'Learn about cloud features')}
              linkHref="https://grafana.com/products/cloud"
            >
              <Trans i18nKey="migrate-to-cloud.what-is-cloud.body">
                Grafana cloud is a fully managed cloud-hosted observability platform ideal for cloud native
                environments. It&apos;s everything you love about Grafana without the overhead of maintaining,
                upgrading, and supporting an installation.
              </Trans>
            </InfoItem>

            <InfoItem
              title={t('migrate-to-cloud.why-host.title', 'Why host with Grafana?')}
              linkTitle={t('migrate-to-cloud.why-host.link-title', 'More questions? Talk to an expert')}
              linkHref="https://grafana.com/contact"
            >
              <Trans i18nKey="migrate-to-cloud.why-host.body">
                In addition to the convenience of managed hosting, Grafana Cloud includes many cloud-exclusive features
                like SLOs, incident management, machine learning, and powerful observability integrations.
              </Trans>
            </InfoItem>

            <InfoItem
              title={t('migrate-to-cloud.is-it-secure.title', 'Is it secure?')}
              linkTitle={t('migrate-to-cloud.is-it-secure.link-title', 'Grafana Labs Trust Center')}
              linkHref="https://trust.grafana.com"
            >
              <Trans i18nKey="migrate-to-cloud.is-it-secure.body">
                Grafana Labs is committed to maintaining the highest standards of data privacy and security. By
                implementing industry-standard security technologies and procedures, we help protect our customers&apos;
                data from unauthorized access, use, or disclosure.
              </Trans>
            </InfoItem>
            <InfoItem
              title={t('migrate-to-cloud.pdc.title', 'What if not all my data sources are on the public internet?')}
              linkTitle={t('migrate-to-cloud.pdc.link-title', 'Learn about PDC')}
              linkHref="https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect"
            >
              <Trans i18nKey="migrate-to-cloud.pdc.body">
                Exposing your data sources to the internet can raise security concerns. Private data source connect
                (PDC) allows Grafana Cloud to access your existing data sources over a secure network tunnel.
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
          </Grid>
        </Stack>
      </Box>
    </Box>
  );
};
