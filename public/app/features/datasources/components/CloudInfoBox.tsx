import { DataSourceSettings } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { Trans, t } from '@grafana/i18n';
import { Alert, TextLink } from '@grafana/ui';
import { LocalStorageValueProvider } from 'app/core/components/LocalStorageValueProvider';
import { config } from 'app/core/config';

const LOCAL_STORAGE_KEY = 'datasources.settings.cloudInfoBox.isDismissed';

export interface Props {
  dataSource: DataSourceSettings;
}

export function CloudInfoBox({ dataSource }: Props) {
  let mainDS = '';
  let extraDS = '';

  // don't show for already configured data sources or provisioned data sources
  if (dataSource.readOnly || (dataSource.version ?? 0) > 2) {
    return null;
  }

  // Skip showing this info box in some editions
  if (config.buildInfo.edition !== GrafanaEdition.OpenSource) {
    return null;
  }

  switch (dataSource.type) {
    case 'prometheus':
      mainDS = 'Prometheus';
      extraDS = 'Loki';
      break;
    case 'loki':
      mainDS = 'Loki';
      extraDS = 'Prometheus';
      break;
    default:
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
            title={t('datasources.cloud-info-box.title-alert', 'Configure your {{mainDS}} data source below', {
              mainDS,
            })}
            severity="info"
            bottomSpacing={4}
            onRemove={() => {
              onDismiss(true);
            }}
          >
            <Trans i18nKey="datasources.cloud-info-box.body-alert">
              Or skip the effort and get {{ mainDS }} (and {{ extraDS }}) as fully-managed, scalable, and hosted data
              sources from Grafana Labs with the{' '}
              <TextLink
                href={`https://grafana.com/signup/cloud/connect-account?src=grafana-oss&cnt=${dataSource.type}-settings`}
                external
              >
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
