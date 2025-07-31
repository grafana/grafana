import { Trans, t } from '@grafana/i18n';
import { Stack } from '@grafana/ui';

import { InfoItem } from '../../shared/InfoItem';

export const InfoPaneLeft = () => {
  return (
    <Stack gap={4} direction="column">
      <InfoItem
        title={t('migrate-to-cloud.what-is-cloud.title', 'What is Grafana Cloud?')}
        linkTitle={t('migrate-to-cloud.what-is-cloud.link-title', 'Learn about cloud features')}
        linkHref="https://grafana.com/products/cloud"
      >
        <Trans i18nKey="migrate-to-cloud.what-is-cloud.body">
          Grafana cloud is a fully managed cloud-hosted observability platform ideal for cloud native environments.
          It&apos;s everything you love about Grafana without the overhead of maintaining, upgrading, and supporting an
          installation.
        </Trans>
      </InfoItem>

      <InfoItem
        title={t('migrate-to-cloud.why-host.title', 'Why host with Grafana?')}
        linkTitle={t('migrate-to-cloud.why-host.link-title', 'More questions? Talk to an expert')}
        linkHref="https://grafana.com/contact"
      >
        <Trans i18nKey="migrate-to-cloud.why-host.body">
          In addition to the convenience of managed hosting, Grafana Cloud includes many cloud-exclusive features like
          SLOs, incident management, machine learning, and powerful observability integrations.
        </Trans>
      </InfoItem>

      <InfoItem
        title={t('migrate-to-cloud.is-it-secure.title', 'Is it secure?')}
        linkTitle={t('migrate-to-cloud.is-it-secure.link-title', 'Grafana Labs Trust Center')}
        linkHref="https://trust.grafana.com"
      >
        <Trans i18nKey="migrate-to-cloud.is-it-secure.body">
          Grafana Labs is committed to maintaining the highest standards of data privacy and security. By implementing
          industry-standard security technologies and procedures, we help protect our customers&apos; data from
          unauthorized access, use, or disclosure.
        </Trans>
      </InfoItem>
    </Stack>
  );
};
