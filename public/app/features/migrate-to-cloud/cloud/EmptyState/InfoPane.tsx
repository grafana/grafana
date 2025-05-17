import { Trans, useTranslate } from '@grafana/i18n';

import { InfoItem } from '../../shared/InfoItem';

export const InfoPane = () => {
  const { t } = useTranslate();

  return (
    <InfoItem title={t('migrate-to-cloud.migrate-to-this-stack.title', 'Let us help you migrate to this stack')}>
      <Trans i18nKey="migrate-to-cloud.migrate-to-this-stack.body">
        You can securely migrate some resources from your self-managed Grafana installation to this cloud stack. To get
        started, you&apos;ll need to generate a migration token. Your self-managed instance will use the token to
        authenticate with this cloud stack.
      </Trans>
    </InfoItem>
  );
};
