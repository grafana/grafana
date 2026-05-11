import { LocalStorageValueProvider } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, TextLink } from '@grafana/ui';
import { isOpenSourceBuildOrUnlicenced } from 'app/features/admin/EnterpriseAuthFeaturesCard';

const LOCAL_STORAGE_KEY = 'provisioning.cloudInfoBox.isDismissed';

export function CloudInfoBox() {
  if (!isOpenSourceBuildOrUnlicenced()) {
    return null;
  }

  return (
    <LocalStorageValueProvider<boolean> storageKey={LOCAL_STORAGE_KEY} defaultValue={false}>
      {(isDismissed, onDismiss) => {
        if (isDismissed) {
          return null;
        }
        return (
          <Alert
            title={t('provisioning.cloud-info-box.title', 'You can also use Git Sync on Grafana Cloud')}
            severity="info"
            bottomSpacing={4}
            onRemove={() => {
              onDismiss(true);
            }}
          >
            <Trans i18nKey="provisioning.cloud-info-box.body">
              Skip the setup and get Git Sync fully managed and hosted on Grafana Cloud with the{' '}
              <TextLink href="https://grafana.com/auth/sign-up/create-user?src=oss-grafana&cnt=git-sync" external>
                free-forever Grafana Cloud plan
              </TextLink>
              .
            </Trans>
          </Alert>
        );
      }}
    </LocalStorageValueProvider>
  );
}
