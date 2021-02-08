import { DataSourceSettings, GrafanaTheme } from '@grafana/data';
import { FeatureInfoBox, useStyles } from '@grafana/ui';
import { css } from 'emotion';
import React, { FC } from 'react';
import { config } from 'app/core/config';
import { GrafanaEdition } from '@grafana/data/src/types/config';
import { LocalStorageValueProvider } from 'app/core/components/LocalStorageValueProvider';

const LOCAL_STORAGE_KEY = 'datasources.settings.cloudInfoBox.isDismissed';

export interface Props {
  dataSource: DataSourceSettings;
}

export const CloudInfoBox: FC<Props> = ({ dataSource }) => {
  const styles = useStyles(getStyles);
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
          <FeatureInfoBox
            title={`Configure your ${mainDS} data source below`}
            className={styles.box}
            branded={false}
            onDismiss={() => {
              onDismiss(true);
            }}
          >
            <div className={styles.text}>
              Or skip the effort and get {mainDS} (and {extraDS}) as fully managed, scalable and hosted data sources
              from Grafana Labs with the{' '}
              <a
                className="external-link"
                href={`https://grafana.com/signup/cloud/connect-account?src=grafana-oss&cnt=${dataSource.type}-settings`}
                target="_blank"
                rel="noreferrer"
                title="The free plan includes 10k active metrics and 50gb storage."
              >
                free-forever Grafana Cloud plan
              </a>
              .
            </div>
          </FeatureInfoBox>
        );
      }}
    </LocalStorageValueProvider>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    box: css`
      margin: 0 0 ${theme.spacing.lg} 0;
    `,
    text: css`
      color: ${theme.colors.textSemiWeak};
      padding: ${theme.spacing.sm} 0;
      a {
        text-decoration: underline;
      }
    `,
  };
};
