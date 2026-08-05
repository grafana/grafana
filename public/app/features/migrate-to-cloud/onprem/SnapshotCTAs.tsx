import { Trans, t } from '@grafana/i18n';
import { Button, Spinner, Text } from '@grafana/ui';

import { CTAInfo } from './CTAInfo';

interface SnapshotCTAProps {
  disabled: boolean;
  isLoading: boolean;
  onClick: () => void;
}

export function CreatingSnapshotCTA(props: SnapshotCTAProps) {
  const { disabled, isLoading, onClick } = props;

  return (
    <CTAInfo title={t('migrate-to-cloud.building-snapshot.title', 'Building snapshot')} accessory={<Spinner inline />}>
      <Text element="p" variant="body" color="secondary">
        <Trans i18nKey="migrate-to-cloud.building-snapshot.description">
          We&apos;re gathering your resources for migration to Grafana Cloud. This should only take a moment.
        </Trans>
      </Text>

      <Button disabled={disabled} onClick={onClick} icon={isLoading ? 'spinner' : undefined} variant="secondary">
        <Trans i18nKey="migrate-to-cloud.summary.cancel-snapshot">Cancel snapshot</Trans>
      </Button>
    </CTAInfo>
  );
}
