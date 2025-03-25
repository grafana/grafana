import { Button, Spinner, Text } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { CTAInfo } from './CTAInfo';

interface SnapshotCTAProps {
  disabled: boolean;
  isLoading: boolean;
  onClick: () => void;
}

export function CreatingSnapshotCTA(props: SnapshotCTAProps) {
  const { disabled, isLoading, onClick } = props;

  return (
    <CTAInfo
      title={t('migrate-to-cloud.building-snapshot.title', 'Building installation snapshot')}
      accessory={<Spinner inline />}
    >
      <Text element="p" variant="body" color="secondary">
        <Trans i18nKey="migrate-to-cloud.building-snapshot.description">
          We&apos;re creating a point-in-time snapshot of the current state of this installation. Once the snapshot is
          complete. you&apos;ll be able to upload it to Grafana Cloud.
        </Trans>
      </Text>

      <Text element="p" variant="body" color="secondary">
        <Trans i18nKey="migrate-to-cloud.building-snapshot.description-eta">
          Creating a snapshot typically takes less than two minutes.
        </Trans>
      </Text>

      <Button disabled={disabled} onClick={onClick} icon={isLoading ? 'spinner' : undefined} variant="secondary">
        <Trans i18nKey="migrate-to-cloud.summary.cancel-snapshot">Cancel snapshot</Trans>
      </Button>
    </CTAInfo>
  );
}
